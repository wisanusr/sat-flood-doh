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
        doc = ts.fetch_trends(Broken(), sleep=lambda s: None)
        self.assertEqual(doc['status'], 'unavailable')
        self.assertIn('429', doc['error'])
        self.assertEqual((doc['rising_queries'], doc['top_queries'], doc['interest_by_region']), ([], [], []))

    def test_empty_result_is_unavailable(self):
        class Empty:
            def build_payload(self, **kw): pass
            def related_queries(self): return {}
            def interest_by_region(self, **kw): return None
        self.assertEqual(ts.fetch_trends(Empty(), sleep=lambda s: None)['status'], 'unavailable')


class FakeTrends:
    """A pytrends stand-in. `fail_timeline` = how many interest_over_time calls raise before one succeeds."""
    def __init__(self, fail_timeline=0, fail_regions=False):
        import pandas as pd
        self.pd, self.fail_timeline, self.fail_regions, self.geo, self.calls = pd, fail_timeline, fail_regions, None, []

    def build_payload(self, kw_list, timeframe, geo):
        self.kw, self.geo = kw_list, geo
        self.calls.append((tuple(kw_list), geo))

    def related_queries(self):
        pd = self.pd
        if self.geo != 'TH':   # per-province lookup: first row is the keyword itself
            return {self.kw[0]: {'top': pd.DataFrame({'query': ['น้ำ ท่วม', 'เลข น้ำ ท่วม'], 'value': [100, 7]}), 'rising': None}}
        rising = pd.DataFrame({'query': ['ลงทะเบียน เยียวยา'], 'value': [3400]})
        top = pd.DataFrame({'query': ['น้ำ ท่วม วันนี้'], 'value': [80]})
        return {kw: {'rising': rising, 'top': top} for kw in self.kw}

    def interest_by_region(self, **kw):
        if self.fail_regions:
            raise RuntimeError('429')
        return self.pd.DataFrame({'น้ำท่วม': [100, 40, 0]}, index=['กระบี่', 'ตาก', 'ภูเก็ต'])

    def interest_over_time(self):
        pd = self.pd
        if self.fail_timeline > 0:
            self.fail_timeline -= 1
            raise RuntimeError('The request failed: Google returned a response with code 429')
        idx = pd.date_range('2026-10-06 03:00', periods=3, freq='h')   # UTC, naive: 10:00-12:00 in Bangkok
        data = {t: [10, 20, 30] for t in ts.TIMELINE_TERMS}
        data['isPartial'] = [False, False, True]
        return pd.DataFrame(data, index=idx)


class TrendsParts(unittest.TestCase):
    def fetch(self, fake):
        return ts.fetch_trends(fake, sleep=lambda s: None)

    def test_all_parts_succeed(self):
        doc = self.fetch(FakeTrends())
        self.assertEqual(doc['status'], 'ok')
        self.assertEqual(set(doc['parts'].values()), {'ok'})
        self.assertEqual(doc['rising_queries'][0]['growth'], '+3400%')
        self.assertEqual([r['region'] for r in doc['interest_by_region']], ['กระบี่', 'ตาก'])   # zero scores dropped

    def test_timeline_is_bangkok_time_without_the_incomplete_hour(self):
        tl = self.fetch(FakeTrends())['timeline']
        self.assertEqual(tl['terms'], ts.TIMELINE_TERMS)
        self.assertEqual([p['t'] for p in tl['points']], ['2026-10-06T10:00+07:00', '2026-10-06T11:00+07:00'])
        self.assertEqual(tl['points'][0]['v'], [10] * 5)

    def test_timeline_429_is_retried_once(self):
        fake = FakeTrends(fail_timeline=1)
        doc = self.fetch(fake)
        self.assertEqual(doc['parts']['timeline'], 'ok')
        self.assertIsNotNone(doc['timeline'])

    def test_timeline_failure_keeps_the_other_parts(self):
        doc = self.fetch(FakeTrends(fail_timeline=5))
        self.assertEqual(doc['status'], 'ok')
        self.assertIsNone(doc['timeline'])
        self.assertIn('429', doc['parts']['timeline'])
        self.assertEqual(doc['parts']['related'], 'ok')
        self.assertTrue(doc['interest_by_region'])

    def test_province_top_query_skips_the_keyword_itself(self):
        fake = FakeTrends()
        doc = self.fetch(fake)
        self.assertEqual(doc['region_top_query']['กระบี่'], {'query': 'เลข น้ำ ท่วม', 'score': 7})
        self.assertIn((('น้ำท่วม',), 'TH-81'), fake.calls)        # Krabi
        self.assertIn((('น้ำท่วม',), 'TH-63'), fake.calls)        # Tak

    def test_no_province_ranking_skips_province_queries(self):
        doc = self.fetch(FakeTrends(fail_regions=True))
        self.assertEqual(doc['region_top_query'], {})
        self.assertTrue(doc['parts']['region_queries'].startswith('skipped'))
        self.assertEqual(doc['status'], 'ok')

    def test_phases_use_real_timeline_terms_and_known_categories(self):
        cats = {key for key, _, _ in ts.CATEGORIES}
        for ph in ts.PHASES:
            self.assertTrue(set(ph['terms']) <= set(ts.TIMELINE_TERMS), ph['key'])
            self.assertTrue(set(ph['categories']) <= cats, ph['key'])
        self.assertEqual({t for ph in ts.PHASES for t in ph['terms']}, set(ts.TIMELINE_TERMS))

    def test_geo_codes_cover_every_province_once(self):
        self.assertEqual(set(ts.PROVINCE_GEO), set(PROVINCES))
        self.assertEqual(len(set(ts.PROVINCE_GEO.values())), 77)


if __name__ == '__main__':
    unittest.main(verbosity=1)
