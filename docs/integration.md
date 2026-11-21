# FashionDesigner ↔ CharacterDesigner ↔ AtelIer 連携仕様（v0.1）

## 確認済みの既存構成
- CharacterDesigner: `chatdraw/` の PySide6 デスクトップアプリ。画像生成、レイヤー編集、PNG/PSD書き出し、人物設定資料、三面図、Blender向け厚み形状の機能が README に記載されている。
- AtelIer: PySide6 のペイントソフト。コードで次を確かめています。
  - 開ける形式は PNG / JPEG / WebP と作業ファイル（`.atelier`）です。書き出せる形式は PNG と PSD です。
  - `python -m atelier --open <ファイル>` で、起動と同時にファイルを開けます。
  - 拡張は `atelier/extensions.py` の口で足します。`name` と `attach(window)` を持つ物を、entry points の `atelier.extensions` の組に書きます。
- FashionDesigner: `studio.html` が画像読み込み、輪郭抽出、SVG/JSON/OBJ出力を持つ。

## 第1段階：ファイルベースの交換（API不要）
1. CharacterDesigner で生成した画像を PNG として保存する。
2. FashionDesigner Studio で PNG を読み込み、輪郭を抽出し編集する。
3. FashionDesigner から SVG（輪郭図面）、JSON（編集可能な輪郭）、OBJ（単純押し出し）を出力する。
4. AtelIer で PNG を開いて加筆する。SVG は拡張「服飾」の「SVG の輪郭をレイヤーとして読む」でレイヤーにできる。JSON/OBJ は AtelIer では読まない。

## 第2段階：共通プロジェクト形式（提案）
`fashiondesigner.project.v1`:
- `source`: 元画像の参照と生成元
- `views`: front/back/side の画像と輪郭
- `pieces`: 身頃、袖、スカート等の個別パーツ（実装予定）
- `measurements`: 実測寸法、単位、根拠
- `layers`: 編集レイヤー（実装予定）
- `exports`: SVG/OBJ/将来のGLB
- `provenance`: 生成元、モデル、時刻（取得できた場合）

寸法は写真から正確に確定できない。実測入力なしに「製造用型紙」と称さない。

## 連携の安全条件
- 既存アプリの未確認APIを呼ばない。
- 外部アプリへの自動送信には送信先の実装と明示的な操作が必要。
- 画像生成は CharacterDesigner 側の実際の生成エンジンを使う。FashionDesigner からの直接起動は、受信API/CLIを調査してから実装する。

## AtelIer の拡張「服飾」
`fashion_designer/extension.py` の `EXTENSION` を、`pyproject.toml` の entry point（`atelier.extensions` の組の `fashion_designer`）で AtelIer に読ませます。
`pip install -e '.[atelier]'` で入れると、AtelIer のメニューバーに「服飾」が出ます。web の部分は標準ライブラリだけで動くよう、atelier は extra にしています。

- 「FashionDesigner の Studio を開く」: `server.py` を裏で起こし、`studio.html` をアプリの窓（QtWebEngine）で開きます。QtWebEngine が無いときだけ既定のブラウザに頼ります。
- 「キャンバスを PNG で FashionDesigner に渡す」: キャンバスを 1 枚にまとめた PNG を `~/FashionDesigner/handoff/`（`FD_HANDOFF_DIR` で変更）に書き、場所をステータスバーに出します。
- 「SVG の輪郭をレイヤーとして読む」: SVG をキャンバスの大きさで描き、新しいレイヤーに重ねます。

確かめ方（AtelIer の `tests` と名前がぶつかるため、ファイルを直に流します）:

```bash
PYTHONPATH=<AtelIer>:<FashionDesigner> QT_QPA_PLATFORM=offscreen python3 tests/test_atelier_extension.py
```

服飾の資料（`casts/fashion.json`、`casts/fashion-zukan/`、`docs/knowledge/fashion/`、`library/samples/fashion/`、`tests/test_fashion.py`）は AtelIer から移しました。

## 統合テスト（未実行）
- CharacterDesignerで実生成したPNGをFashionDesignerに読み込む。
- FashionDesignerの抽出→SVG/JSON/OBJ出力を検証する。
- JSONの再読み込みで輪郭が維持されるか検証する。
- Studio から書いた SVG を AtelIer で読み、PNG で戻す往復でデータの欠落がないか検証する。
