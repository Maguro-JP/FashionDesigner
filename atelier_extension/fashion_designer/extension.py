"""FashionDesigner を AtelIer の拡張として付ける（atelier/extensions.py の口）。

本体はこのパッケージを読まない。拡張の置き場（ProgramData\\AtelIer\\extensions\\FashionDesigner\\）に
extension.json と一緒に置かれ、本体の窓に「3Dデザイン」のメニューと、衣服の形を作るダイアログを足す。
生成は FashionDesigner 本体の mesh_core（2D 輪郭を押し出した閉じた三角形メッシュ、標準ライブラリのみ）を使う。
プレビューはメッシュを斜めから見た線画（2D 投影）で、正確なレンダリングではない。
このファイルは AtelIer の中で動くので、画面には AtelIer と同じ PySide6 を使う。
"""
from __future__ import annotations

import importlib.util
import math
from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtGui import QAction, QColor, QPainter, QPen, QPixmap, QPolygonF
from PySide6.QtCore import QPointF
from PySide6.QtWidgets import (QComboBox, QDialog, QFileDialog, QFormLayout, QHBoxLayout,
                               QLabel, QMenu, QMessageBox, QPushButton, QSpinBox, QVBoxLayout)

MENU = "ファッションデザイン"

SHAPE_LABELS = (("rect", "長方形"), ("circle", "円"), ("triangle", "三角形"), ("ell", "L字"))


def load_core():
    """mesh_core を探して読む。置き場に一緒に入れた物（インストール時）を先に、
    無ければこのリポジトリの根の物（開発時）を使う"""
    here = Path(__file__).resolve()
    candidates = [here.parents[1] / "mesh_core.py",          # 拡張の置き場 / atelier_extension の直下
                  here.parents[2] / "mesh_core.py"]          # リポジトリの根
    for path in candidates:
        if path.is_file():
            spec = importlib.util.spec_from_file_location("fashion_designer_core", path)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            return mod
    raise ImportError("mesh_core.py が見つかりません")


def preset_points(kind: str, width: float, height: float) -> list[tuple[float, float]]:
    """形の見本を、幅・高さに合わせて点列（画像座標、y は下向き）にする"""
    if kind == "circle":
        pts = [(50 + 50 * math.cos(2 * math.pi * i / 24), 50 + 50 * math.sin(2 * math.pi * i / 24))
               for i in range(24)]
    elif kind == "triangle":
        pts = [(50, 0), (100, 100), (0, 100)]
    elif kind == "ell":
        pts = [(0, 0), (100, 0), (100, 40), (40, 40), (40, 100), (0, 100)]
    else:
        pts = [(0, 0), (100, 0), (100, 100), (0, 100)]
    return [(x * width / 100.0, y * height / 100.0) for x, y in pts]


class MeshDialog(QDialog):
    """輪郭の形と厚みを選び、押し出したメッシュの投影を見て、OBJ / GLB で保存するダイアログ"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.core = load_core()
        self._custom_points = None   # 試験や将来の読み込み用: 点列を直接渡すとき
        self.setWindowTitle("衣服の形を作る")
        self.shape = QComboBox()
        for key, label in SHAPE_LABELS:
            self.shape.addItem(label, key)
        self.width = self._spin(10, 1000, 100)
        self.height = self._spin(10, 1000, 100)
        self.depth = self._spin(1, 500, 20)
        form = QFormLayout()
        form.addRow("形", self.shape)
        form.addRow("幅", self.width)
        form.addRow("高さ", self.height)
        form.addRow("厚み", self.depth)
        self.preview = QLabel()
        self.preview.setAlignment(Qt.AlignCenter)
        self.preview.setMinimumSize(320, 320)
        self.status = QLabel("")
        save_obj = QPushButton("OBJで保存…")
        save_glb = QPushButton("GLBで保存…")
        close = QPushButton("閉じる")
        save_obj.clicked.connect(self._save_obj)
        save_glb.clicked.connect(self._save_glb)
        close.clicked.connect(self.accept)
        row = QHBoxLayout()
        row.addWidget(save_obj)
        row.addWidget(save_glb)
        row.addStretch(1)
        row.addWidget(close)
        lay = QVBoxLayout(self)
        lay.addLayout(form)
        lay.addWidget(self.preview)
        lay.addWidget(self.status)
        lay.addLayout(row)
        self.shape.currentIndexChanged.connect(self._refresh)
        for w in (self.width, self.height, self.depth):
            w.valueChanged.connect(self._refresh)
        self._refresh()

    @staticmethod
    def _spin(lo, hi, val):
        s = QSpinBox()
        s.setRange(lo, hi)
        s.setValue(val)
        return s

    def points(self) -> list[tuple[float, float]]:
        if self._custom_points is not None:
            return list(self._custom_points)
        return preset_points(self.shape.currentData(), self.width.value(), self.height.value())

    def current_mesh(self):
        """今の入力でメッシュ（頂点, 面）を作る。輪郭が不正なら core のエラーをそのまま上げる"""
        return self.core.extruded_mesh(self.points(), float(self.depth.value()))

    def current_obj(self) -> str:
        return self.core.export_obj(self.points(), float(self.depth.value()))

    def current_glb(self) -> bytes:
        return self.core.export_glb(self.points(), float(self.depth.value()))

    def _refresh(self):
        try:
            vertices, faces = self.current_mesh()
        except Exception as e:   # noqa: BLE001  入力の誤りはプレビューの代わりに理由を出す
            self.status.setText(str(e))
            self.preview.setPixmap(QPixmap())
            return
        self.status.setText(f"頂点 {len(vertices)}、面 {len(faces)}")
        self.preview.setPixmap(self._project(vertices, faces))

    @staticmethod
    def _project(vertices, faces, size=320) -> QPixmap:
        """メッシュを斜め方向へ単純投影した線画。奥行きは右上へずらして表す"""
        proj = [(x + 0.45 * z, y + 0.25 * z) for x, y, z in vertices]   # y は上向きのまま
        xs = [p[0] for p in proj]
        ys = [p[1] for p in proj]
        span = max(max(xs) - min(xs), max(ys) - min(ys), 1.0)
        scale = (size - 40) / span
        cx = size / 2 - (min(xs) + max(xs)) / 2 * scale
        cy = size / 2 + (min(ys) + max(ys)) / 2 * scale
        pix = QPixmap(size, size)
        pix.fill(Qt.transparent)
        p = QPainter(pix)
        p.setPen(QPen(QColor(60, 60, 60), 1))
        p.setBrush(QColor(37, 99, 235, 60))
        for a, b, c in faces:
            pts = [QPointF(cx + proj[i][0] * scale, cy - proj[i][1] * scale) for i in (a, b, c)]
            p.drawPolygon(QPolygonF(pts))
        p.end()
        return pix

    def _save_obj(self):
        try:
            obj = self.current_obj()
        except Exception as e:   # noqa: BLE001
            QMessageBox.warning(self, "形を作れません", str(e))
            return
        path, _ = QFileDialog.getSaveFileName(self, "OBJで保存", "model.obj", "OBJ (*.obj)")
        if path:
            Path(path).write_text(obj, encoding="utf-8")

    def _save_glb(self):
        try:
            glb = self.current_glb()
        except Exception as e:   # noqa: BLE001
            QMessageBox.warning(self, "形を作れません", str(e))
            return
        path, _ = QFileDialog.getSaveFileName(self, "GLBで保存", "model.glb", "GLB (*.glb)")
        if path:
            Path(path).write_bytes(glb)


class FashionDesignerExtension:
    name = "fashion-designer"

    def attach(self, window) -> None:
        menu = QMenu(MENU, window)
        act = QAction("衣服の形を作る…", window)
        act.setToolTip("衣服の輪郭の形と厚みから立体メッシュを作り、OBJ / GLB で保存します")
        act.triggered.connect(lambda _=False: MeshDialog(window).exec())
        menu.addAction(act)
        window.menuBar().addMenu(menu)
        window.fashion_designer_menu = menu   # 窓に参照を持たせる（メニューが消えないように）


EXTENSION = FashionDesignerExtension()
