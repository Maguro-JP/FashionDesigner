# CHANGELOG

## 2026-11-27

- AtelIer の拡張を追加（`atelier_extension/`）。AtelIer の拡張の置き場に入れると、「ファッションデザイン」のメニューから輪郭と厚みを選ぶダイアログが開き、立体メッシュの投影プレビューを見ながら OBJ / GLB で保存できる。生成は `mesh_core.py` をそのまま使う。
- `atelier_extension/install.ps1` を追加：拡張一式と `mesh_core.py` を `C:\ProgramData\AtelIer\extensions\FashionDesigner\` へ入れる。
- `test_extension.py` を追加：拡張の形、ダイアログの生成、本体の置き場読み込み（load_dropins）での登録のテスト。
