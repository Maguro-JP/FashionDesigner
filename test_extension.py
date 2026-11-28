"""AtelIer 拡張の試験。拡張の形、ダイアログでメッシュが作れること、本体の置き場読み込みで登録できること"""
import json
import os
import shutil
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "atelier_extension"))

try:
    from PySide6.QtWidgets import QApplication, QMainWindow
    HAS_QT = True
except ImportError:
    HAS_QT = False


def _app():
    return QApplication.instance() or QApplication([])


@unittest.skipUnless(HAS_QT, "PySide6 が無い環境では拡張の試験をしない")
class ExtensionShapeTest(unittest.TestCase):
    def test_manifest_and_object(self):
        spec = json.loads((ROOT / "atelier_extension" / "extension.json").read_text(encoding="utf-8"))
        self.assertEqual(spec["module"], "fashion_designer.extension")
        self.assertEqual(spec["attr"], "EXTENSION")
        from fashion_designer.extension import EXTENSION
        self.assertEqual(EXTENSION.name, "fashion-designer")
        self.assertTrue(callable(EXTENSION.attach))

    def test_attach_adds_menu(self):
        _app()
        from fashion_designer.extension import EXTENSION
        win = QMainWindow()
        EXTENSION.attach(win)
        titles = [a.text() for a in win.menuBar().actions()]
        self.assertIn("ファッションデザイン", titles)


@unittest.skipUnless(HAS_QT, "PySide6 が無い環境では拡張の試験をしない")
class DialogTest(unittest.TestCase):
    def setUp(self):
        _app()
        from fashion_designer.extension import MeshDialog
        self.dlg = MeshDialog()

    def test_default_obj_builds(self):
        obj = self.dlg.current_obj()
        self.assertIn("# FashionDesigner mesh export", obj)
        self.assertTrue(any(line.startswith("v ") for line in obj.splitlines()))
        self.assertTrue(any(line.startswith("f ") for line in obj.splitlines()))
        glb = self.dlg.current_glb()
        self.assertEqual(glb[:4], b"glTF")

    def test_self_intersecting_outline_is_an_error(self):
        # 蝶ネクタイ型（自己交差）の輪郭は core が拒否する
        self.dlg._custom_points = [(0, 0), (100, 100), (100, 0), (0, 100)]
        with self.assertRaises(ValueError):
            self.dlg.current_obj()
        self.dlg._refresh()
        self.assertNotEqual(self.dlg.status.text(), "")
        self.assertTrue(self.dlg.preview.pixmap().isNull())


class DropInLoadTest(unittest.TestCase):
    """本体（AtelIer）の load_dropins で、インストールした形のフォルダが登録できること"""

    def test_loads_through_atelier(self):
        atelier_home = os.environ.get("ATELIER_HOME", str(ROOT.parent / "AtelIer-work"))
        if not (Path(atelier_home) / "atelier" / "extensions.py").is_file():
            self.skipTest("AtelIer のソースが近くに無い")
        sys.path.insert(0, atelier_home)
        from atelier import extensions
        with TemporaryDirectory() as d:
            dst = Path(d) / "FashionDesigner"
            shutil.copytree(ROOT / "atelier_extension", dst)
            shutil.copy2(ROOT / "mesh_core.py", dst / "mesh_core.py")
            
            names = extensions.load_dropins(Path(d))
            self.assertIn("fashion-designer", names)
            self.assertIn("fashion-designer", [e.name for e in extensions.registered()])


if __name__ == "__main__":
    unittest.main()
