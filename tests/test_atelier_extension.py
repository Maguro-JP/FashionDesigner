"""拡張「服飾」を AtelIer の窓に付けて、メニューと PNG の受け渡しを確かめる。

PYTHONPATH に AtelIer と FashionDesigner を入れ、QT_QPA_PLATFORM=offscreen で流す。AtelIer が無ければ飛ばす。
"""
import os
import tempfile
import unittest
from pathlib import Path

try:
    from PySide6.QtWidgets import QApplication
    from atelier import extensions
    from atelier.app.main_window import Window
except ImportError as e:  # AtelIer か PySide6 が無い環境
    Window = None
    REASON = str(e)

from fashion_designer import extension as fd


@unittest.skipIf(Window is None, "AtelIer が読めない")
class AtelierExtensionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QApplication.instance() or QApplication([])
        cls.tmp = tempfile.TemporaryDirectory()
        os.environ["FD_HANDOFF_DIR"] = cls.tmp.name
        extensions.register(fd.EXTENSION)
        cls.win = Window()

    @classmethod
    def tearDownClass(cls):
        cls.win.close()
        extensions.unregister(fd.EXTENSION)
        cls.tmp.cleanup()

    def menu(self):
        menus = [a.menu() for a in self.win.menuBar().actions() if a.text() == "服飾"]
        self.assertEqual(len(menus), 1)
        return menus[0]

    def test_menu_has_actions(self):
        texts = [a.text() for a in self.menu().actions()]
        self.assertIn("FashionDesigner の Studio を開く", texts)
        self.assertIn("キャンバスを PNG で FashionDesigner に渡す", texts)

    def test_png_handoff_writes_file(self):
        action = next(a for a in self.menu().actions() if a.text().startswith("キャンバスを PNG"))
        before = set(Path(self.tmp.name).glob("atelier-*.png"))
        action.trigger()
        made = set(Path(self.tmp.name).glob("atelier-*.png")) - before
        self.assertEqual(len(made), 1)
        self.assertGreater(next(iter(made)).stat().st_size, 0)
        self.assertIn(str(next(iter(made))), self.win.statusBar().currentMessage())

    def test_svg_becomes_layer(self):
        svg = Path(self.tmp.name) / "outline.svg"
        svg.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">'
                       '<path d="M8 8 L56 8 L32 56 Z" stroke="black" fill="none"/></svg>')
        n = len(self.win.canvas.layers)
        self.assertTrue(fd.load_svg_as_layer(self.win, str(svg)))
        self.assertEqual(len(self.win.canvas.layers), n + 1)


if __name__ == "__main__":
    unittest.main()
