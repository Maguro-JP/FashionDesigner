# 決定記録

| 日付 (JST) | 決めたこと | 理由 | 触る場所 |
|---|---|---|---|
| 2026-11-21 | Node.js + TypeScript の CLI/ライブラリとして作る。画面は後回し | まず「分解」を確実に動かす。ライブラリにしておけば Atelier 等から import でき、画面は後で載せられる。案: 最初から Vite 画面（不採用: 範囲拡大） | package.json, src/cli.ts |
| 2026-11-21 | 平面図は AI に SVG を直接描かせず、テンプレート＋パラメーターで描く | 出力が安定し、前後の一致・はみ出しを試験で担保できる。数値を直せば再描画できる。案: 画像生成 AI（不採用: 寸法が信用できない） | src/render/flat.ts, src/schema.ts の *Flat |
| 2026-11-21 | 受け渡し形式は GarmentSpec JSON（schema: fashion-designer/garment-spec@1） | 連携先の実装を見られないため、JSON 1 種に絞って結合を緩くする | src/schema.ts, docs/integration.md |
| 2026-11-21 | 解析モデルは claude-opus-5-5、effort high。環境変数 FASHION_MODEL で変更可 | 画像の読み取り精度を優先 | src/analyze.ts |
| 2026-11-21 | 拒否時のサーバー側フォールバックは未設定。stop_reason=refusal はエラーで返す | 構造化出力の parse と beta 引数の併用を未検証のため | src/analyze.ts |
| 2026-11-21 | 自由記述は日本語、列挙値は英語固定 | 列挙値はプログラムと他ツールが読むため | src/analyze.ts の SYSTEM |
| 2026-11-21 | 寸法は M サイズ想定の推定値 | 画像から実寸は取れない。確度は confidence に出す | src/analyze.ts, Measurement |
| 2026-11-21 | AtelIer に画像生成の機能が無いため、展開用の画像は Canva の画像生成で作った | AtelIer のリポジトリは README とスキルだけで、呼べる入口が無い。AtelIer に機能ができたら差し替える | samples/canva-painter/ |
| 2026-11-21 | トップスの平面図を、寸法（身幅・着丈・袖丈）から cm 単位で形を起こす描き方に変えた。肩の作り（set-in / drop / raglan）、ポケットの形、リブの線、エプロンの型を足した | 決まった形を当てはめる描き方では元の服に見えないと指摘されたため。寸法が無いときは fit と length から既定値を使う | src/render/top.ts, src/schema.ts の TopFlat |
