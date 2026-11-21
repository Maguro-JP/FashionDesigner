# FashionDesigner ↔ CharacterDesigner ↔ AtelIer 連携仕様（v0.1）

## 確認済みの既存構成
- CharacterDesigner: `chatdraw/` の PySide6 デスクトップアプリ。画像生成、レイヤー編集、PNG/PSD書き出し、人物設定資料、三面図、Blender向け厚み形状の機能が README に記載されている。
- AtelIer: README は「ペイントソフト」のみ。ファイル形式、API、起動方式、受信インターフェースは確認できていない。連携実装済みとは扱わない。
- FashionDesigner: `studio.html` が画像読み込み、輪郭抽出、SVG/JSON/OBJ出力を持つ。

## 第1段階：ファイルベースの交換（API不要）
1. CharacterDesigner で生成した画像を PNG として保存する。
2. FashionDesigner Studio で PNG を読み込み、輪郭を抽出し編集する。
3. FashionDesigner から SVG（輪郭図面）、JSON（編集可能な輪郭）、OBJ（単純押し出し）を出力する。
4. AtelIer が PNG を読み込める場合は元画像を開いて加筆する。AtelIer 側の対応形式が未確認のため、SVG/JSON/OBJ を直接読み込めるとは主張しない。

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
- AtelIer との双方向編集は、同アプリのコード構成と入出力仕様を確認してから実装する。

## 統合テスト（未実行）
- CharacterDesignerで実生成したPNGをFashionDesignerに読み込む。
- FashionDesignerの抽出→SVG/JSON/OBJ出力を検証する。
- JSONの再読み込みで輪郭が維持されるか検証する。
- AtelIerが実際に対応する形式を確認し、往復編集でデータ欠落がないか検証する。
