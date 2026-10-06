"""
news_scraper.py
Flood news pipeline for the dashboard's "ข่าว" tab (moved from SAT_flood, v2.0).

Fetches RSS/HTML sources, keeps flood-related items from the last HOURS_WINDOW hours,
scores words with TF-IDF and writes one file, docs/news_data/news.json (see build_news_json()).
Only headline, source, link and time are published; article text is used for scoring and then dropped.

Usage: python news/news_scraper.py [output_dir]      (default: docs/news_data)
"""

import json
import re
import math
import sys
from datetime import datetime, timedelta, timezone
from urllib.parse import unquote
from collections import Counter, defaultdict
from pathlib import Path

import requests
import feedparser
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent))
from provinces import extract_province

if hasattr(sys.stdout, 'reconfigure'):  # Windows console encoding
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ──────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "news_data"
TZ_BKK = timezone(timedelta(hours=7))

# Keep only items published within this many hours
HOURS_WINDOW = 30
MAX_ENTRIES_PER_FEED = 50
MAX_ARTICLES_OUT = 100

# ──────────────────────────────────────────────
# คำค้นหาที่ใช้ search — ห้ามแสดงใน Word Cloud
# เพราะ "แน่นอน" ว่าต้องปรากฏ ไม่ได้บอกประเด็น
# ──────────────────────────────────────────────
SEARCH_QUERY_WORDS = {
    # ไทย
    "น้ำท่วม", "อุทกภัย", "น้ำหลาก", "น้ำล้น", "น้ำท่วมขัง", "น้ำ",
    "ท่วม", "ท่วมขัง", "ท่วมสูง",
    # อังกฤษ
    "flood", "flooding", "floods", "flooded", "inundation",
    "floodwater", "floodwaters",
}

# ──────────────────────────────────────────────
# STOPWORDS ไทย (คำทั่วไป ไม่ใช่ประเด็น)
# ──────────────────────────────────────────────
THAI_STOPWORDS = {
    # function words / particles
    "ของ","ใน","และ","ที่","มี","ได้","การ","ให้","จาก","เป็น","ว่า","จะ","ด้วย","นี้",
    "แต่","ไม่","กับ","ยัง","ก็","จึง","โดย","ซึ่ง","เพื่อ","หรือ","มา","ไป","อยู่",
    "กัน","นั้น","เมื่อ","เพราะ","แล้ว","เพิ่ม","ขึ้น","ลง","เช่น","ทั้ง","หาก",
    "ต้อง","รวม","ต่อ","ถึง","เข้า","ออก","ขณะ","ส่วน","ดัง","พร้อม","ตาม",
    "ด้าน","ทำให้","ทั้งนี้","เขา","เธอ","พวก","เรา","พวกเรา","ทั้งหมด",
    "อีก","เพียง","แม้","เพื่อให้","สำหรับ","นำ","ตน","ทั้ง","บาง",
    "ซึ่ง","อัน","เหล่า","เหล่านี้","ดัง","ดังกล่าว","ดังนั้น","ดังนี้",
    "ต่อไป","นับแต่","ตั้งแต่","ขณะที่","อย่างไร","อย่างไรก็","แม้ว่า",
    "ซึ่ง","ดัง","ใด","ใคร","อะไร","เมื่อไหร่","อย่างใด","ทั้งนั้น",
    # หน่วยนับ/เวลา
    "คน","วัน","ปี","เดือน","ชั่วโมง","นาที","วินาที","บาท","ร้อย","พัน",
    "หมื่น","ล้าน","แห่ง","แห่งที่","ราย","ครั้ง","แบบ","ชนิด","ประเภท",
    # verbs ทั่วไป
    "กล่าว","กล่าวว่า","เปิดเผย","ระบุ","พบ","ชี้","ห่วง","แจ้ง","คาด",
    "ทราบ","เชื่อ","ยืนยัน","ปฏิเสธ","เตือน","สั่ง","ขอ","ช่วย","ส่ง","รับ",
    "รายงาน","เร่ง","ดำเนิน","ดำเนินการ","ดำเนินงาน","ปฏิบัติ","ดูแล",
    "ติดตาม","ตรวจสอบ","ประสาน","บูรณาการ","บริหาร","จัดการ",
    "มอบ","รวบรวม","สนับสนุน","ออก","เดิน","บอก","ทำ","ใช้","ขาย","ซื้อ",
    "เปิด","ปิด","ยก","ลด","เพิ่ม","ปรับ","วาง","ตั้ง","วาง","วัด",
    # nouns generic
    "ข้อมูล","สถิติ","สถานการณ์","พื้นที่","บริเวณ","ประเทศ","ไทย",
    "รัฐบาล","หน่วยงาน","เจ้าหน้าที่","ทหาร","ตำรวจ","ผู้ว่า","นายก",
    "รัฐมนตรี","กระทรวง","กรม","สำนัก","องค์กร","ศูนย์","คณะ",
    "ประชาชน","ราษฎร","ชาวบ้าน","ชาว","ผู้","ผู้ว่าฯ","นายกฯ",
    "จังหวัด","อำเภอ","ตำบล","ชุมชน","เขต","แขวง","หมู่บ้าน","หมู่",
    "วันที่","เวลา","ช่วง","ระยะ","ประมาณ","ราว","ประมาณการ",
    "ผล","ผลการ","สรุป","รายละเอียด","ขั้นตอน","แผน","แผนการ",
    "เรื่อง","ประเด็น","กรณี","เหตุการณ์","สาเหตุ","ผลกระทบ",
    "ช่วยเหลือ","บรรเทา","ป้องกัน","แก้ไข","ฟื้นฟู","รับมือ","เตรียม",
    "ปภ","สจ","กทม","ทบ","อบต","อบจ","รพ","สสจ",  # ตัวย่อที่ไม่บอกประเด็น
    # ชื่อสำนักข่าว (boilerplate)
    "สวพ","ผู้จัดการ","แนวหน้า","เดลินิวส์","คมชัดลึก","ข่าวสด","ไทยโพสต์",
    "สยามรัฐ","มติชน","ไทยรัฐ","กรุงเทพธุรกิจ","ประชาชาติ","ฐานเศรษฐกิจ",
    "บางกอกโพสต์","เนชั่น","เนชั่นทีวี","อมรินทร์","เวิร์คพอยท์","ทรูวิชั่น",
    "ไทยพีบีเอส","สปริง","ทีวีพูล","ช่องวัน","ช่อง","เช้าหัวเขียว",
    # คำสั้นเกิน / คำนำหน้า
    "นาย","นาง","นางสาว","ดร","ศ","รศ","ผศ","พล","พลตำรวจ","พลทหาร",
    "ผ่าน","มา","ไป","ให้","กับ","ต่อ","จาก","ถึง","ใน","บน","ที่",
    "เผย","บอก","ชี้แจง","ระบุ","ยืนยัน",
    # คำ generic อื่น
    "อัปเดต","ออนไลน์","ล่าสุด","ทันที","เร็วๆ","บัดนี้","ขณะนี้",
    "เคียงข้าง",  # campaign slogan ไม่ใช่ประเด็น
    "กว่า","ลุย","สูง","ตกหนัก","ประชุม","แพ่ง","เร่ง",
    # คำการเมือง/บุคคล/Noise ที่ไม่เกี่ยวกับการเฝ้าระวัง
    "พรรคเพื่อไทย","พรรค","สส","ส.ส.","ชัชชาติ","อนุทิน","ฝ่ายค้าน","การเมือง",
    "วันนี้","แจก","จุล","มิติ","สื่อสาร","พลัง","เคหะ","ได้รับ","หลาย",
    "เริ่ม","ฟ้า","พันธิ์","รับเงิน","เช็ค","บก","สิ่","ร่วม","ความ","อย่าง",
    # คำ Noise 2-3 ตัวอักษร/คำกริยา/คำกว้างที่ไม่สื่อประเด็น
    "รอ","ทีม","เด็ก","หลัง","ชุด","โอน","จ่าย","เงิน","งบ","หุ้น","สว","ข่าว",
    "รัฐ","ฝั่ง","ภาค","กลาง","เดอะ","เตอร์","รีพอร์ต","กำลังใจ","มีใจ","การเรียน",
    "ประกันภัย","ต่อ","เนื่อง","ต่อเนื่อง","ทวี","คง","ยังคง","กล่อง",
    "สำรวจ","ประสพ","ประสบ","ทาง","ระบบ","เดินหน้า","เรื่อง",
    "ตุลาคม","กันยายน","พฤศจิกายน","สิงหาคม","เมษายน","ดอนเมือง","ถนนสายหลัก",
    # ชื่อเพจ/สื่อออนไลน์/แคมเปญ
    "เดอะรีพอร์ตเตอร์","ผู้จัดการออนไลน์","มิติหุ้น","อินน์นิวส์","ไทยคู่ฟ้า",
    "เดอะรีพอร์ต","รีพอร์ตเตอร์","มิติ","ออนไลน์","ผู้จัดการ",
}

# ──────────────────────────────────────────────
# COMPOUND WORDS FOR TRIE TOKENIZER
# ──────────────────────────────────────────────
COMPOUND_WORDS_TH = [
    "ผู้ประสบอุทกภัย", "ผู้ประสบภัย", "เงินเยียวยา", "ถุงยังชีพ", "จุดท่วมขัง",
    "ประตูระบายน้ำ", "เครื่องสูบน้ำ", "พนังกั้นน้ำ", "คันกั้นน้ำ", "สถานีสูบน้ำ",
    "อ่างเก็บน้ำ", "ท้ายเขื่อน", "เจ้าพระยา", "ป่าสักชลสิทธิ์", "ขุดลอกคลอง",
    "ทางระบายน้ำ", "ทุ่งรับน้ำ", "เยียวยาผู้ประสบภัย", "ศูนย์พักพิง", "สุขาเคลื่อนที่",
    "เรือพลาสติก", "โรงครัวพระราชทาน", "น้ำท่วมขัง", "ฝนตกหนัก", "ร่องมรสุม",
    "ปริมาณฝน", "ระดับน้ำ", "ปริมาณน้ำ", "ล้นตลิ่ง", "น้ำหลาก", "ทะเลหนุน",
    "ถนนสายหลัก", "การระบายน้ำ", "แจ้งเตือนภัย", "เฝ้าระวังพิเศษ", "ยกของขึ้นที่สูง",
    "หลังน้ำท่วม", "หลังน้ำลด", "ฟื้นฟูหลังน้ำท่วม", "เยียวยาหลังน้ำท่วม", "โรคหลังน้ำท่วม",
    "ขยะหลังน้ำท่วม", "ซ่อมแซมบ้าน", "ทำความสะอาดบ้าน",
]

# ──────────────────────────────────────────────
# WORD CATEGORIES & DOMAIN BOOSTING
# ──────────────────────────────────────────────
MONITORING_KEYWORDS = {
    # สภาพน้ำ / ระดับน้ำ / การระบาย
    "ระดับน้ำ", "ปริมาณน้ำ", "ล้นตลิ่ง", "ทะลัก", "น้ำหลาก", "ทะเลหนุน", "ทุ่งรับน้ำ",
    "น้ำเอ่อ", "ระดับ", "ระบายน้ำ", "ผันน้ำ", "แก้มลิง", "ทางน้ำ", "ตลิ่ง", "มวลน้ำ",
    "น้ำขัง", "ท่วมขัง", "ไหลหลาก", "ระบาย", "เอ่อล้น",
    # เขื่อน / สถานี / โครงสร้าง
    "เขื่อน", "ประตูระบายน้ำ", "เครื่องสูบน้ำ", "พนังกั้นน้ำ", "คันกั้นน้ำ", "ขุดลอก",
    "สถานีสูบน้ำ", "อ่างเก็บน้ำ", "ท้ายเขื่อน", "เจ้าพระยา", "ป่าสัก", "ป่าสักชลสิทธิ์",
    # เฝ้าระวัง / สภาพอากาศ / เตือนภัย
    "เฝ้าระวัง", "เตือนภัย", "จุดเสี่ยง", "จุดท่วมขัง", "ฝนตกหนัก", "พายุ", "ร่องมรสุม",
    "มรสุม", "ตกหนัก", "เสี่ยงภัย", "สีแดง", "สีส้ม", "วิกฤต", "ปริมาณฝน", "ฝน", "ขัง",
    "เสี่ยง", "เตือน", "เฝ้าระวังพิเศษ",
}

RELIEF_KEYWORDS = {
    "อพยพ", "ศูนย์พักพิง", "ยกของขึ้นที่สูง", "เตรียมรับมือ", "ถุงยังชีพ", "ยังชีพ",
    "เยียวยา", "แจกจ่าย", "ถุง", "ผู้ประสบภัย", "ผู้ประสบอุทกภัย", "เรือพลาสติก",
    "สุขาเคลื่อนที่", "โรงครัว", "ช่วยเหลือ", "บรรเทา", "เยียวยาผู้ประสบภัย",
}

POST_FLOOD_KEYWORDS = {
    "หลังน้ำท่วม", "หลังน้ำลด", "ฟื้นฟู", "ทำความสะอาด", "ซ่อมแซม", "ขยะ",
    "ฟื้นฟูหลังน้ำท่วม", "เยียวยาหลังน้ำท่วม", "โรคหลังน้ำท่วม", "ขยะหลังน้ำท่วม",
    "ล้างบ้าน", "เชื้อรา", "ซ่อมบ้าน",
}

LOCATION_KEYWORDS = {
    "กรุงเทพมหานคร", "กทม", "ปทุมธานี", "นนทบุรี", "ฉะเชิงเทรา", "อยุธยา",
    "พระนครศรีอยุธยา", "เชียงใหม่", "เชียงราย", "ปราจีนบุรี", "ลาดกระบัง",
    "ดอนเมือง", "สุโขทัย", "แพร่", "น่าน", "ตาก", "บุรีรัมย์", "อุบลราชธานี",
    "นครราชสีมา", "นครสวรรค์", "อ่างทอง", "สิงห์บุรี", "เมือง",
}

MONITORING_BOOST_FACTOR = 2.5
RELIEF_BOOST_FACTOR = 1.5
POST_FLOOD_BOOST_FACTOR = 2.0

def classify_urgency(title: str, text: str = "") -> str:
    combined = title + " " + text
    crit_kw = ["วิกฤต", "ทะลัก", "อพยพ", "ด่วน", "เสียชีวิต", "จม", "ทะลุคัน", "ตัดขาด", "ดินถล่ม", "จมมิด", "ท่วมสูง", "ฉุกเฉิน", "ติดค้าง", "ขอความช่วยเหลือ"]
    if any(k in combined for k in crit_kw):
        return "critical"
    warn_kw = ["เฝ้าระวัง", "เตือน", "เสี่ยง", "เพิ่มขึ้น", "ระดับน้ำสูง", "เตรียมพร้อม", "ฝนตกหนัก", "น้ำขึ้น", "เร่งระบาย", "เอ่อล้น", "ยกของขึ้นที่สูง", "เตรียมยก", "มรสุม", "พายุ", "จับตา", "น้ำหลาก"]
    if any(k in combined for k in warn_kw):
        return "warning"
    rec_kw = ["ฟื้นฟู", "เยียวยา", "บริจาค", "แจก", "ทำความสะอาด", "บรรเทา", "ลดลง", "เข้าสู่ภาวะปกติ", "ช่วยเหลือ", "ถุงยังชีพ", "ซ่อมแซม", "คลี่คลาย", "เงินเยียวยา"]
    if any(k in combined for k in rec_kw):
        return "recovery"
    return "warning"



# ──────────────────────────────────────────────
# STOPWORDS อังกฤษ
# ──────────────────────────────────────────────
ENG_STOPWORDS = {
    "the","a","an","and","or","but","in","on","at","to","for","of","with","by",
    "from","is","are","was","were","be","been","being","have","has","had",
    "do","does","did","will","would","could","should","may","might","shall",
    "this","that","these","those","it","its","he","she","they","we","you",
    "i","my","your","his","her","their","our","who","which","what","when",
    "where","how","as","if","so","then","than","up","out","about","into",
    "through","after","before","over","under","more","all","also","just",
    "not","no","can","said","says","say","per","cent","percent","also",
    "one","two","three","four","five","than","more","most","such","like",
    "new","news","report","year","month","day","week","time","government",
    "official","minister","department","agency","province","thailand","thai",
    "bangkok","water","area","level","nbsp","facebook","twitter","line",
    "reuters","today","share","read","more","click","here","photo",
    # boilerplate seo
    "source","via","related","articles","article","read","latest","update",
    "reporters","online","households",
    # ชื่อสำนักข่าวไทย (รั่วมาในภาษาอังกฤษ)
    "thairath","thaipost","thaipbs","matichon","sanook","kapook","khaosod",
    "prachachat","nationtv","amarintv","posttoday","thairath","workpoint",
    "spring","live","room","post","nation","standard","manager","daily",
    "naewna","komchadluek","bangkokpost","bangkokbiznews",
    # คำอื่นๆ ที่ไม่บอกประเด็น
    "home","back","next","prev","prev","page","menu","search","close",
    "email","print","save","comment","view","full","more","show","hide",
    "click","open","close","sign","login","register","subscribe",
}

# ──────────────────────────────────────────────
# RSS FEEDS
# ──────────────────────────────────────────────
RSS_FEEDS = [
    "https://news.google.com/rss/search?q=น้ำท่วม&hl=th&gl=TH&ceid=TH:th",
    "https://news.google.com/rss/search?q=หลังน้ำท่วม&hl=th&gl=TH&ceid=TH:th",
    "https://news.google.com/rss/search?q=อุทกภัย&hl=th&gl=TH&ceid=TH:th",
    "https://news.google.com/rss/search?q=ฟื้นฟู+น้ำท่วม&hl=th&gl=TH&ceid=TH:th",
    "https://news.google.com/rss/search?q=flood+Thailand&hl=en&gl=TH&ceid=TH:en",
    "https://www.matichon.co.th/feed",
    "https://news.thaipbs.or.th/rss/news",
    "https://www.thairath.co.th/rss/news",
]

# HTML pages scraped for headlines: [{"url", "name", "selector"}]. Empty on purpose: the old
# disaster.go.th/th/news page no longer exists (404). Add an entry only after checking its markup.
DIRECT_SOURCES = []

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
    )
}

FLOOD_KEYWORDS_TH = [
    "น้ำท่วม","อุทกภัย","น้ำล้น","ระดับน้ำ","น้ำหลาก","น้ำท่วมขัง",
    "น้ำเอ่อ","น้ำท่วมสูง","ฝนตกหนัก","พายุ","ดินถล่ม","เขื่อน",
    "ระบายน้ำ","อพยพ","ผู้ประสบภัย","ภัยพิบัติ","ท่วม","หลังน้ำท่วม","หลังน้ำลด","ฟื้นฟู",
]
FLOOD_KEYWORDS_EN = [
    "flood","flooding","inundation","storm","rainfall","water level",
    "overflow","evacuation","disaster","monsoon","dam","submerged",
]

# ──────────────────────────────────────────────
# BOILERPLATE PATTERNS ที่ต้องตัดออก
# (pattern ที่ซ้ำกันในทุกบทความจาก Google News)
# ──────────────────────────────────────────────
BOILERPLATE_RE = re.compile(
    r'(thairath\.co\.th|matichon\.co\.th|thaipbs\.or\.th|'
    r'thestandard\.co|khaosod\.co\.th|prachachat\.net|'
    r'sanook\.com|kapook\.com|line\s*today|FM\s*\d+|'
    r'&nbsp;|&amp;|&lt;|&gt;|&quot;|&#\d+;|\||\-\s*\w+\.)',
    re.IGNORECASE
)

# ──────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────
def clean_text(raw: str) -> str:
    """ทำความสะอาดข้อความก่อน tokenize"""
    # ลบ HTML entities
    text = re.sub(r'&[a-zA-Z]+;|&#\d+;', ' ', raw)
    # ลบ HTML tags
    text = re.sub(r'<[^>]+>', ' ', text)
    # ลบ URLs
    text = re.sub(r'https?://\S+', ' ', text)
    # ลบ boilerplate สำนักข่าว
    text = BOILERPLATE_RE.sub(' ', text)
    # ลบ punctuation ที่ไม่ใช่อักษร
    text = re.sub(r'[^\u0E00-\u0E7Fa-zA-Z\s]', ' ', text)
    # ลบ whitespace ซ้ำ
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def dedup_title_in_text(title: str, text: str) -> str:
    """
    RSS title มักซ้ำอยู่ใน summary/text
    ลบ title ออกจาก text เพื่อไม่ให้นับซ้ำ
    """
    clean_title = clean_text(title)
    # ลบ title ที่อยู่ใน text (ซ้ำๆ)
    if clean_title and len(clean_title) > 10:
        text = text.replace(clean_title, ' ')
    return text


def is_flood_related(text: str) -> bool:
    text_lower = text.lower()
    return any(k.lower() in text_lower for k in FLOOD_KEYWORDS_TH + FLOOD_KEYWORDS_EN)


_domain_trie = None

def get_domain_trie():
    global _domain_trie
    if _domain_trie is None:
        try:
            from pythainlp.tokenize import Trie
            _domain_trie = Trie(COMPOUND_WORDS_TH)
        except Exception:
            _domain_trie = False
    return _domain_trie


def tokenize_th(text: str) -> list:
    """Tokenize ภาษาไทย พร้อมใช้ Custom Trie เพื่อรวมคำประสมสำคัญ"""
    try:
        from pythainlp.tokenize import word_tokenize
        trie = get_domain_trie()
        if trie:
            tokens = word_tokenize(text, custom_dict=trie, engine="newmm", keep_whitespace=False)
        else:
            tokens = word_tokenize(text, engine="newmm", keep_whitespace=False)
        return [t.strip() for t in tokens if t.strip()]
    except ImportError:
        return re.findall(r'[\u0E00-\u0E7F]+', text)


def tokenize_en(text: str) -> list:
    return re.findall(r'[a-zA-Z]{4,}', text.lower())


ALLOWED_2CHAR_WORDS = {"ฝน", "ขัง", "กทม", "ปภ", "ทบ", "คลอง", "เขื่อน"}

def is_valid_th(token: str) -> bool:
    """เช็คว่าเป็นคำภาษาไทยที่ควรแสดง"""
    if not re.match(r'^[\u0E00-\u0E7F]+$', token):
        return False
    if token in THAI_STOPWORDS or token in SEARCH_QUERY_WORDS:
        return False
    if re.match(r'^[\u0E50-\u0E59]+$', token):  # ตัวเลขไทย
        return False
    if len(token) < 2:
        return False
    if len(token) == 2 and token not in ALLOWED_2CHAR_WORDS:
        return False
    return True


def is_valid_en(token: str) -> bool:
    """เช็คว่าเป็นคำภาษาอังกฤษที่ควรแสดง"""
    return (
        len(token) >= 4
        and token not in ENG_STOPWORDS
        and token not in SEARCH_QUERY_WORDS
        and re.match(r'^[a-zA-Z]+$', token)
    )


# ──────────────────────────────────────────────
# SCRAPERS — each returns (articles, error_or_None)
# ──────────────────────────────────────────────
def now_utc():
    return datetime.now(timezone.utc)


def scrape_rss(feed_url: str, now=None, parsed=None):
    """Parse one RSS feed. `parsed` lets tests inject an already-parsed feed."""
    now = now or now_utc()
    cutoff = now - timedelta(hours=HOURS_WINDOW)
    articles = []
    try:
        feed = parsed if parsed is not None else feedparser.parse(feed_url, request_headers=HEADERS)
        if not feed.entries and getattr(feed, "bozo", 0):
            return [], str(getattr(feed, "bozo_exception", "feed could not be parsed"))[:200]
        feed_title = feed.feed.get("title", "") if hasattr(feed, "feed") else ""
        for entry in feed.entries[:MAX_ENTRIES_PER_FEED]:
            title = getattr(entry, "title", "") or ""
            summary = getattr(entry, "summary", "") or ""

            pub = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
            if not pub:
                continue  # an undated item cannot be placed in the window; skip it rather than guess
            pub_dt = datetime(*pub[:6], tzinfo=timezone.utc)  # feedparser gives UTC
            if pub_dt < cutoff or pub_dt > now + timedelta(hours=1):
                continue

            clean_title = clean_text(title)
            clean_summary = dedup_title_in_text(clean_title, clean_text(summary))
            combined = (clean_title + " " + clean_summary).strip()
            if not is_flood_related(combined):
                continue
            # Google News feeds carry the real outlet in <source>; the feed title is just the search query.
            outlet = (entry.get("source") or {}).get("title") if hasattr(entry, "get") else None
            articles.append({
                "title": title,
                "title_clean": clean_title,
                "text_clean": combined,
                "source": outlet or feed_title or feed_url,
                "url": getattr(entry, "link", ""),
                "published_at": pub_dt.astimezone(TZ_BKK).isoformat(timespec="minutes"),
                "age_hours": round((now - pub_dt).total_seconds() / 3600, 1),
            })
    except Exception as e:  # network/parse failure of one feed must not stop the others
        return [], str(e)[:200]
    return articles, None


def scrape_direct(source: dict):
    """Headline list of an HTML page. These pages carry no dates, so published_at/age_hours are None."""
    articles = []
    try:
        resp = requests.get(source["url"], headers=HEADERS, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        for el in soup.select(source["selector"])[:50]:
            raw = el.get_text(separator=" ").strip()
            cleaned = clean_text(raw)
            if cleaned and is_flood_related(cleaned):
                articles.append({
                    "title": raw[:200],
                    "title_clean": cleaned[:200],
                    "text_clean": cleaned,
                    "source": source["name"],
                    "url": source["url"],
                    "published_at": None,
                    "age_hours": None,
                })
    except Exception as e:
        return [], str(e)[:200]
    return articles, None


def feed_label(url: str) -> str:
    if "q=" in url:
        return "Google News: " + unquote(url.split("q=")[-1].split("&")[0]).replace("+", " ")
    return re.sub(r"^https?://(www\.)?", "", url).split("/")[0]


# ──────────────────────────────────────────────
# TF-IDF WORD SCORING
# ──────────────────────────────────────────────
def build_tfidf_scores(articles: list, lang: str) -> dict:
    """
    คำนวณ TF-IDF score ต่อคำ
    - TF  = ความถี่ในบทความนั้น (normalized)
    - IDF = log(N / df) — คำที่ปรากฏทุกบทความได้ score ต่ำ
    Return: {word: tfidf_sum} เรียงจากมากไปน้อย
    """
    N = len(articles)
    if N == 0:
        return {}

    # สร้าง token list ต่อบทความ
    doc_tokens = []
    for a in articles:
        text = a["text_clean"]
        if lang == "th":
            tokens = [t for t in tokenize_th(text) if is_valid_th(t)]
        else:
            tokens = [t for t in tokenize_en(text) if is_valid_en(t)]
        doc_tokens.append(tokens)

    # คำนวณ DF (document frequency)
    df = defaultdict(int)
    for tokens in doc_tokens:
        for word in set(tokens):  # นับแต่ละบทความครั้งเดียว
            df[word] += 1

    # คำนวณ TF-IDF รวมทุกบทความ
    tfidf_sum = defaultdict(float)
    for tokens in doc_tokens:
        if not tokens:
            continue
        tf_counter = Counter(tokens)
        total = len(tokens)
        for word, count in tf_counter.items():
            tf = count / total
            idf = math.log((N + 1) / (df[word] + 1)) + 1  # smoothed IDF
            score = tf * idf
            if lang == "th":
                if word in MONITORING_KEYWORDS:
                    score *= MONITORING_BOOST_FACTOR
                elif word in RELIEF_KEYWORDS:
                    score *= RELIEF_BOOST_FACTOR
                elif word in POST_FLOOD_KEYWORDS:
                    score *= POST_FLOOD_BOOST_FACTOR
            tfidf_sum[word] += score

    # กรองคำที่ปรากฏน้อยเกินไป (< 2 บทความ) — อาจเป็น noise
    tfidf_filtered = {
        w: s for w, s in tfidf_sum.items()
        if df[w] >= 2  # ต้องปรากฏในอย่างน้อย 2 บทความ
    }

    return dict(sorted(tfidf_filtered.items(), key=lambda x: -x[1]))


def build_raw_freq(articles: list, lang: str) -> dict:
    """
    Raw frequency (ยังกรองคำค้นหาออก + dedup ข้อความ)
    ใช้ประกอบเพื่อดูจำนวนครั้งที่ปรากฏจริงๆ
    """
    counter = Counter()
    for a in articles:
        text = a["text_clean"]
        if lang == "th":
            tokens = [t for t in tokenize_th(text) if is_valid_th(t)]
        else:
            tokens = [t for t in tokenize_en(text) if is_valid_en(t)]
        counter.update(tokens)
    return dict(counter.most_common(200))


# ──────────────────────────────────────────────
# OUTPUT
# ──────────────────────────────────────────────
def dedup(articles: list) -> list:
    """Drop repeats of the same headline (first 60 characters of the cleaned title)."""
    seen, unique = set(), []
    for a in articles:
        key = a["title_clean"][:60].strip()
        if key and key not in seen:
            seen.add(key)
            unique.append(a)
    return unique


def get_word_category(w: str) -> str:
    if w in MONITORING_KEYWORDS:
        return "monitoring"
    if w in RELIEF_KEYWORDS:
        return "relief"
    if w in POST_FLOOD_KEYWORDS:
        return "post_flood"
    if w in LOCATION_KEYWORDS:
        return "location"
    return "general"


def merge_scores(tfidf: dict, raw_freq: dict, top_n: int) -> dict:
    """Rank by TF-IDF but report raw counts (easier to read as cloud size). Needs >= 2 mentions."""
    return {w: raw_freq[w] for w in list(tfidf)[:top_n] if raw_freq.get(w, 0) >= 2}


def build_news_json(articles: list, source_status: list, now=None) -> dict:
    """The document the dashboard's news tab reads. `articles` must already be de-duplicated."""
    now = now or now_utc()
    tfidf_th = build_tfidf_scores(articles, "th")
    tfidf_en = build_tfidf_scores(articles, "en")
    cloud_th = merge_scores(tfidf_th, build_raw_freq(articles, "th"), 80)
    cloud_en = merge_scores(tfidf_en, build_raw_freq(articles, "en"), 60)
    # Newest first; undated (direct-page) items go last.
    ordered = sorted(articles, key=lambda a: (a["age_hours"] is None, a["age_hours"] or 0))
    return {
        "generated_at": now.astimezone(TZ_BKK).isoformat(timespec="seconds"),
        "window_hours": HOURS_WINDOW,
        "article_count": len(articles),
        "sources": source_status,
        "word_freq": {"th": cloud_th, "en": cloud_en},
        "tfidf_scores": {
            "th": {k: round(v, 4) for k, v in list(tfidf_th.items())[:80]},
            "en": {k: round(v, 4) for k, v in list(tfidf_en.items())[:60]},
        },
        "word_categories": {w: get_word_category(w) for w in cloud_th},
        "articles": [{
            "title": a["title"][:180],
            "source": a["source"],
            "url": a["url"],
            "published_at": a["published_at"],
            "age_hours": a["age_hours"],
            "urgency": classify_urgency(a["title"], a["text_clean"]),
            "province": extract_province(a["title_clean"], a["text_clean"]),
        } for a in ordered[:MAX_ARTICLES_OUT]],
    }


def main(output_dir=None):
    out_dir = Path(output_dir or (sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUTPUT_DIR))
    out_dir.mkdir(parents=True, exist_ok=True)
    now = now_utc()
    print(f"[{now.astimezone(TZ_BKK):%H:%M:%S}] เริ่มกวาดข่าวน้ำท่วม (ย้อนหลัง {HOURS_WINDOW} ชม.)")

    all_articles, status = [], []
    jobs = [(feed_label(u), lambda u=u: scrape_rss(u, now)) for u in RSS_FEEDS]
    jobs += [(s["name"], lambda s=s: scrape_direct(s)) for s in DIRECT_SOURCES]
    for name, job in jobs:
        arts, err = job()
        status.append({"name": name, "status": "error" if err else "ok", "count": len(arts), **({"error": err} if err else {})})
        print(f"  {name}: {'ERROR ' + err if err else str(len(arts)) + ' บทความ'}")
        all_articles.extend(arts)

    unique = dedup(all_articles)
    print(f"  รวม {len(unique)} บทความ (ไม่ซ้ำ) จากทั้งหมด {len(all_articles)}")
    if not any(s["status"] == "ok" for s in status):
        print("ทุกแหล่งล้มเหลว — ไม่เขียนไฟล์ข่าวใหม่")
        return 1

    payload = build_news_json(unique, status, now)
    target = out_dir / "news.json"
    tmp = target.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(target)
    print(f"  บันทึก → {target}")
    print("  คำเด่น (ไทย):", ", ".join(list(payload["word_freq"]["th"])[:10]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
