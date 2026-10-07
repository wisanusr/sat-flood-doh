"""Offline tests for the news pipeline: python3 news/test_news.py (needs feedparser; pythainlp optional)."""
import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path

import feedparser

sys.path.insert(0, str(Path(__file__).parent))
import news_scraper as ns
import trends_scraper as ts
from provinces import extract_province, PROVINCES, NATIONWIDE

NOW = datetime(2026, 10, 6, 12, 0, tzinfo=timezone.utc)


def rss(*items):
    body = ''.join(
        '<item><title>%s</title><link>%s</link><description>%s</description><pubDate>%s</pubDate>%s</item>'
        % (t, 'https://example.com/' + str(i), d, format_datetime(when) if when else '',
           '<source url="https://x">%s</source>' % src if src else '')
        for i, (t, d, when, src) in enumerate(items))
    return feedparser.parse('<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title>%s</channel></rss>' % body)


def hours_ago(h):
    return datetime.fromtimestamp(NOW.timestamp() - h * 3600, tz=timezone.utc)


class Provinces(unittest.TestCase):
    def test_aliases_and_canonical_names(self):
        self.assertEqual(extract_province('น้ำท่วมกรุงเทพฯ หนัก'), 'กรุงเทพมหานคร')
        self.assertEqual(extract_province('อยุธยาเฝ้าระวัง'), 'พระนครศรีอยุธยา')
        self.assertEqual(len(PROVINCES), 77)

    def test_ambiguous_names_need_prefix(self):
        self.assertEqual(extract_province('เจ้าหน้าที่ไม่รู้เลย'), NATIONWIDE)
        self.assertEqual(extract_province('โรคแพร่ระบาดหลังน้ำท่วม'), NATIONWIDE)
        self.assertEqual(extract_province('จ.เลย น้ำท่วม'), 'เลย')

    def test_title_beats_summary_and_first_mention_wins(self):
        self.assertEqual(extract_province('น้ำท่วม จังหวัดน่าน และกรุงเทพมหานคร'), 'น่าน')
        self.assertEqual(extract_province('น้ำท่วมหนัก', 'ที่ชลบุรี'), 'ชลบุรี')


class Classification(unittest.TestCase):
    def test_urgency(self):
        self.assertEqual(ns.classify_urgency('ด่วน อพยพชาวบ้าน'), 'critical')
        self.assertEqual(ns.classify_urgency('เตือนฝนตกหนัก'), 'warning')
        self.assertEqual(ns.classify_urgency('ฟื้นฟูหลังน้ำลด'), 'recovery')


class Scrape(unittest.TestCase):
    def test_window_floodrelated_and_outlet(self):
        feed = rss(
            ('น้ำท่วมปราจีนบุรี', 'ระดับน้ำสูง', hours_ago(2), 'มติชน'),
            ('น้ำท่วมเก่า', 'x', hours_ago(60), None),            # outside the 30 h window
            ('ราคาทองวันนี้', 'ขึ้นลง', hours_ago(1), None),        # not flood related
            ('น้ำท่วมไม่มีวันที่', 'x', None, None),               # undated: skipped
        )
        arts, err = ns.scrape_rss('https://example.com/feed', NOW, parsed=feed)
        self.assertIsNone(err)
        self.assertEqual([a['title'] for a in arts], ['น้ำท่วมปราจีนบุรี'])
        self.assertEqual(arts[0]['source'], 'มติชน')
        self.assertEqual(arts[0]['age_hours'], 2.0)
        self.assertTrue(arts[0]['published_at'].endswith('+07:00'))

    def test_dedup(self):
        a = {'title_clean': 'น้ำท่วมกรุงเทพ ล่าสุด'}
        self.assertEqual(len(ns.dedup([a, dict(a), {'title_clean': 'อีกข่าว'}])), 2)

    def test_broken_feed_reports_error(self):
        bad = feedparser.parse('<html>not a feed')
        arts, err = ns.scrape_rss('https://example.com/feed', NOW, parsed=bad)
        self.assertEqual(arts, [])
        self.assertTrue(err)


class Output(unittest.TestCase):
    def setUp(self):
        titles = [('น้ำท่วมกรุงเทพมหานคร เขื่อนระบายน้ำ', 3), ('เขื่อนเจ้าพระยาระบายน้ำ ฝนตกหนัก', 5),
                  ('ด่วน อพยพ น้ำท่วมปทุมธานี เขื่อน', 1), ('ฟื้นฟูหลังน้ำท่วม เยียวยาผู้ประสบภัย', 8)]
        self.articles = []
        for t, h in titles:
            self.articles.append({'title': t, 'title_clean': t, 'text_clean': t, 'source': 'S',
                                  'url': 'u', 'published_at': 'p', 'age_hours': float(h)})

    def test_schema_and_privacy(self):
        doc = ns.build_news_json(self.articles, [{'name': 'S', 'status': 'ok', 'count': 4}], NOW)
        for key in ('generated_at', 'window_hours', 'article_count', 'sources', 'word_freq', 'tfidf_scores', 'word_categories', 'articles'):
            self.assertIn(key, doc)
        self.assertEqual(doc['article_count'], 4)
        self.assertEqual([a['age_hours'] for a in doc['articles']], [1.0, 3.0, 5.0, 8.0])  # newest first
        self.assertEqual(doc['articles'][0]['urgency'], 'critical')
        self.assertEqual(doc['articles'][0]['province'], 'ปทุมธานี')
        self.assertNotIn('text_clean', doc['articles'][0])
        self.assertNotIn('text_clean', json.dumps(doc))
        for word, n in doc['word_freq']['th'].items():
            self.assertGreaterEqual(n, 2)
            self.assertNotIn(word, ns.SEARCH_QUERY_WORDS)

    def test_undated_items_sort_last(self):
        self.articles[0]['age_hours'] = None
        doc = ns.build_news_json(self.articles, [], NOW)
        self.assertIsNone(doc['articles'][-1]['age_hours'])

    def test_main_does_not_write_when_every_source_fails(self):
        orig = ns.scrape_rss, ns.RSS_FEEDS, ns.DIRECT_SOURCES
        ns.scrape_rss = lambda url, now=None, parsed=None: ([], 'boom')
        ns.RSS_FEEDS, ns.DIRECT_SOURCES = ['https://example.com/a'], []
        try:
            with tempfile.TemporaryDirectory() as d:
                self.assertEqual(ns.main(d), 1)
                self.assertFalse((Path(d) / 'news.json').exists())
        finally:
            ns.scrape_rss, ns.RSS_FEEDS, ns.DIRECT_SOURCES = orig


class Trends(unittest.TestCase):
    def test_categorize_uses_only_given_queries(self):
        rising = [{'query': 'ลงทะเบียน เยียวยา น้ำท่วม'}, {'query': 'ระดับน้ำ ปิง'}, {'query': 'เรื่องอื่น'}]
        groups = ts.categorize(rising)
        self.assertEqual([q['query'] for q in groups['financial']], ['ลงทะเบียน เยียวยา น้ำท่วม'])
        self.assertEqual([q['query'] for q in groups['surveillance']], ['ระดับน้ำ ปิง'])
        self.assertEqual(sum(len(v) for v in groups.values()), 2)

    def test_failure_is_reported_not_faked(self):
        class Broken:
            def build_payload(self, **kw): raise RuntimeError('429 Too Many Requests')
        doc = ts.fetch_trends(Broken())
        self.assertEqual(doc['status'], 'unavailable')
        self.assertIn('429', doc['error'])
        self.assertEqual((doc['rising_queries'], doc['top_queries'], doc['interest_by_region']), ([], [], []))

    def test_empty_result_is_unavailable(self):
        class Empty:
            def build_payload(self, **kw): pass
            def related_queries(self): return {}
            def interest_by_region(self, **kw): return None
        self.assertEqual(ts.fetch_trends(Empty())['status'], 'unavailable')


if __name__ == '__main__':
    unittest.main(verbosity=1)
