"""Validate the isolated test modes against the generated Pages HTML."""
from pathlib import Path
import unittest
from build_mobile_tests import diagnostic_html

class MobilePagesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original=Path('docs/index.html').read_text(encoding='utf-8')
        cls.recorder=Path('flood_web/mobile-diagnostics.js').read_text(encoding='utf-8')

    def test_snapshot_keeps_map_and_skips_live(self):
        html=diagnostic_html(self.original,'snapshot',self.recorder)
        self.assertIn("if(false&&typeof upgradeLive==='function'){",html)
        self.assertNotIn("if(false){const mapScript=",html)
        self.assertIn('<base href="../">',html)

    def test_no_map_keeps_live_and_skips_leaflet(self):
        html=diagnostic_html(self.original,'no-map',self.recorder)
        self.assertIn("if(typeof upgradeLive==='function'){",html)
        self.assertIn("if(false){const mapScript=",html)
        self.assertIn('document.head.appendChild(mapScript);}',html)

    def test_control_keeps_both(self):
        html=diagnostic_html(self.original,'control',self.recorder)
        self.assertNotIn('if(false)',html)
        self.assertIn("if(typeof upgradeLive==='function'){",html)

    def test_bad_mode_rejected(self):
        with self.assertRaises(AssertionError):diagnostic_html(self.original,'unknown',self.recorder)

if __name__=='__main__':unittest.main()
