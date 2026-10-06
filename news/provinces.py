"""Find the province a news item is about, using the names in flood_web/thai_provinces.json (pro_th)."""
import re

PROVINCES = """พะเยา เชียงราย แพร่ น่าน ตาก สุโขทัย อุทัยธานี กำแพงเพชร นครสวรรค์ เพชรบูรณ์ พิษณุโลก พิจิตร
นครราชสีมา บุรีรัมย์ สมุทรสาคร สมุทรสงคราม สุพรรณบุรี นครปฐม ราชบุรี บึงกาฬ กาญจนบุรี หนองบัวลำภู ลพบุรี ชัยภูมิ
สิงห์บุรี พระนครศรีอยุธยา อำนาจเจริญ อ่างทอง อุบลราชธานี ยโสธร นนทบุรี สุรินทร์ ปทุมธานี กรุงเทพมหานคร ศรีสะเกษ
สมุทรปราการ เพชรบุรี ประจวบคีรีขันธ์ อุดรธานี เลย ชลบุรี ขอนแก่น ระนอง ชุมพร ภูเก็ต สุราษฎร์ธานี กระบี่ มุกดาหาร พังงา
สระแก้ว สกลนคร นครศรีธรรมราช นครพนม ปราจีนบุรี ร้อยเอ็ด นครนายก กาฬสินธุ์ ตราด หนองคาย ฉะเชิงเทรา มหาสารคาม ระยอง
จันทบุรี ชัยนาท สระบุรี ลำปาง อุตรดิตถ์ เชียงใหม่ ลำพูน นราธิวาส ปัตตานี ยะลา ตรัง พัทลุง สงขลา แม่ฮ่องสอน สตูล""".split()

# Short forms people write in headlines -> canonical name
ALIASES = {
    'กรุงเทพฯ': 'กรุงเทพมหานคร', 'กรุงเทพ': 'กรุงเทพมหานคร', 'กทม': 'กรุงเทพมหานคร',
    'อยุธยา': 'พระนครศรีอยุธยา', 'โคราช': 'นครราชสีมา', 'อุบลฯ': 'อุบลราชธานี',
}
# Names that are also ordinary Thai words ("เลย" = at all, "แพร่" = spread, ...): only count with a จังหวัด/จ. prefix.
AMBIGUOUS = {'เลย', 'ตาก', 'น่าน', 'แพร่', 'ตรัง', 'ระนอง'}
NATIONWIDE = 'ภาพรวมประเทศ'

assert len(PROVINCES) == 77 and len(set(PROVINCES)) == 77


def _pattern(name):
    esc = re.escape(name)
    if name in AMBIGUOUS:
        return r'(?:จังหวัด|จ\.)\s*' + esc
    return esc


_NAMES = [(n, n) for n in PROVINCES] + list(ALIASES.items())
# Longest alternatives first so "กรุงเทพมหานคร" wins over "กรุงเทพ" at the same position.
_REGEX = re.compile('|'.join(
    '(?P<g%d>%s)' % (i, _pattern(alias))
    for i, (alias, _) in sorted(enumerate(_NAMES), key=lambda p: -len(p[1][0]))))


def _first(text):
    m = _REGEX.search(text or '')
    if not m:
        return None
    return _NAMES[int(m.lastgroup[1:])][1]


def extract_province(title, text=''):
    """Province named first in the title, else first in the summary, else the nationwide label."""
    return _first(title) or _first(text) or NATIONWIDE
