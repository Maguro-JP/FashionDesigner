"""AtelIer の拡張「服飾」。AtelIer のメニューバーに「服飾」を足し、FashionDesigner と絵をやり取りする。

AtelIer 本体はこの拡張を知らない（依存は「拡張 → AtelIer」の向きだけ）。
entry points の `atelier.extensions` の組から読まれ、窓ができたあとに attach(window) が 1 回呼ばれる。

Studio はブラウザではなくアプリの窓で開く（AtelIer の決まり）。server.py を裏で起こし、
QtWebEngine の窓に studio.html を出す。QtWebEngine が無い環境だけ、既定のブラウザに頼る。
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]          # server.py と studio.html のある所
PORT = 8765                                         # server.py が待ち受ける番号（server.py と揃える）
STUDIO_URL = f"http://127.0.0.1:{PORT}/studio.html"


def handoff_dir() -> Path:
    """AtelIer から FashionDesigner へ渡す絵の置き場。FD_HANDOFF_DIR で替えられる（テストで一時フォルダにするため）"""
    return Path(os.environ.get("FD_HANDOFF_DIR") or Path.home() / "FashionDesigner" / "handoff")


def export_canvas_png(window) -> Path:
    """キャンバスを 1 枚にまとめて PNG で書き、書いた場所を返す。上書きしないよう名前に時刻を入れる"""
    folder = handoff_dir()
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"atelier-{datetime.now():%Y%m%d-%H%M%S-%f}.png"
    if not window.canvas.flatten().save(str(path), "PNG"):
        raise OSError(f"PNG を書けませんでした: {path}")
    return path


def load_svg_as_layer(window, svg_path: str) -> bool:
    """SVG（型紙の輪郭など）をキャンバスの大きさで描き、新しいレイヤーとして重ねる"""
    from PySide6.QtCore import Qt
    from PySide6.QtGui import QImage, QPainter
    from PySide6.QtSvg import QSvgRenderer

    renderer = QSvgRenderer(svg_path)
    if not renderer.isValid():
        return False
    w, h = window.canvas.size_px()
    if not w:
        size = renderer.defaultSize()
        w, h = max(1, size.width()), max(1, size.height())
    img = QImage(w, h, QImage.Format_ARGB32_Premultiplied)
    img.fill(Qt.transparent)
    p = QPainter(img)
    renderer.render(p)
    p.end()
    # add_image_layer はファイルから読むので、一度 PNG にしてから渡す（元に戻すの仕組みを本体のまま使うため）
    tmp = handoff_dir() / f"svg-{Path(svg_path).stem}.png"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(tmp), "PNG")
    window.canvas.add_image_layer(str(tmp), f"輪郭 {Path(svg_path).stem}")
    return True


class FashionExtension:
    name = "fashion"

    def __init__(self):
        self._server: subprocess.Popen | None = None
        self._views: list = []   # 開いた Studio の窓。参照を持たないと閉じられてしまう

    # --- Studio ---
    def _server_alive(self) -> bool:
        try:
            with urllib.request.urlopen(STUDIO_URL, timeout=0.5) as r:
                return r.status == 200
        except OSError:
            return False

    def start_server(self) -> bool:
        if self._server_alive():
            return True
        self._server = subprocess.Popen([sys.executable, str(ROOT / "server.py")], cwd=str(ROOT),
                                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(50):
            if self._server_alive():
                return True
            time.sleep(0.1)
        return False

    def open_studio(self, window) -> None:
        from PySide6.QtCore import QUrl
        if not self.start_server():
            window.statusBar().showMessage("FashionDesigner の server.py を起動できませんでした", 8000)
            return
        try:
            from PySide6.QtWebEngineWidgets import QWebEngineView
        except ImportError:   # QtWebEngine が無いときだけブラウザに頼る
            from PySide6.QtGui import QDesktopServices
            QDesktopServices.openUrl(QUrl(STUDIO_URL))
            return
        view = QWebEngineView()
        view.setWindowTitle("FashionDesigner Studio")
        view.resize(1280, 860)
        view.load(QUrl(STUDIO_URL))
        view.show()
        self._views.append(view)

    # --- AtelIer の窓へ ---
    def attach(self, window) -> None:
        menu = window.menuBar().addMenu("服飾")
        menu.setObjectName("fashion_menu")
        menu.addAction("FashionDesigner の Studio を開く", lambda: self.open_studio(window))

        def send_png():
            try:
                path = export_canvas_png(window)
            except OSError as e:
                window.statusBar().showMessage(str(e), 8000)
                return
            window.statusBar().showMessage(f"FashionDesigner に渡す PNG を書きました: {path}", 10000)

        menu.addAction("キャンバスを PNG で FashionDesigner に渡す", send_png)

        def read_svg():
            from PySide6.QtWidgets import QFileDialog
            path, _ = QFileDialog.getOpenFileName(window, "SVG の輪郭を読む", str(handoff_dir()), "SVG (*.svg)")
            if path and not load_svg_as_layer(window, path):
                window.statusBar().showMessage(f"SVG を読めませんでした: {path}", 8000)

        menu.addAction("SVG の輪郭をレイヤーとして読む", read_svg)

    def unload(self) -> None:
        if self._server and self._server.poll() is None:
            self._server.terminate()


EXTENSION = FashionExtension()
