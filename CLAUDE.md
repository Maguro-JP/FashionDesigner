# FashionDesigner

応答は日本語・です/ます調。太字（アスタリスク）は使わない。決定はその場で docs/decisions.md に書く。

## 必ず読むファイル
- docs/decisions.md（決定と理由）
- docs/integration.md（Atelier / CharacterDesigner との受け渡し形式）
- .worklog/ の最新分（git 管理外。無ければ無視）

## 構成
- src/schema.ts: GarmentSpec（zod）。全機能と外部連携の唯一の受け渡し形式
- src/analyze.ts: 画像/ブリーフ -> GarmentSpec（Claude API, 構造化出力）
- src/render/flat.ts: GarmentSpec.flat -> 前後の平面図 SVG（パラメトリック）
- src/render/techpack.ts: 仕様書 HTML
- src/output.ts / src/cli.ts: 書き出しと CLI

## 作法
- スキーマを変えたら SCHEMA_ID の版を上げ、docs/integration.md を更新する
- テンプレートに選択肢を足すと test/render.test.ts が全組み合わせを自動で検査する。はみ出しを許す修正はしない
- 見た目の修正はスクリーンショットで確認してから行う
- 検証: `npm run typecheck && npm test`

## 用語
- 平面図 = フラットスケッチ（flat）
- 仕様書 = テックパック（tech pack）
- 分解 = 画像から着用アイテムを個別の GarmentSpec 項目に分けること
