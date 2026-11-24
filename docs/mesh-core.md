# FashionDesigner 3Dメッシュ基盤

## 目的と範囲

`mesh_core.py` はFashionDesignerの2D輪郭データを独立して再利用できる閉じた三角形メッシュへ変換し、OBJまたはglTF 2.0 GLBを出力するPython標準ライブラリのみのコアです。現段階は単一の単純ポリゴンを一定厚みで押し出す処理です。衣服パネルの展開・縫合・人体への着装を実装したものではありません。

## 入力契約

- 輪郭点は `(x, y)` の有限数値で、少なくとも3つの異なる頂点が必要です。
- 始点と終点の重複は自動で除去します。
- 面積0、自己交差、重なり辺、2000点超の入力は明示的に拒否します。
- `depth` は正の有限値です。呼び出し元が単位を決め、OBJは単位コメントとして「input units」と出します。
- 入力画像のY軸は下向きなので、3D出力ではYを反転して上向きにします。

## API

- `triangulate(points)` は凹形状対応のear clippingで面を三角形に分割します。
- `extruded_mesh(points, depth)` は上下のcapと側面を含む三角形meshを返します。
- `export_obj(points, depth)` は頂点と三角形面を持つOBJ文字列を返します。
- `export_glb(points, depth)` は外部バッファ不要の単一mesh GLBを返します。

既存StudioのOBJ処理を置き換える場合は、JavaScript側で形状JSONを保存し、ローカルPythonサーバーへ送るAPIを追加する必要があります。このコミットではコアの導入に範囲を絞っています。

## 検証

`python -m unittest -v test_mesh_core.py` で凹輪郭面積保存、閉メッシュの全辺が2面に共有されること、OBJ三角面、GLB header/JSON、自己交差拒否、厚みの入力検査を確認します。

GLBはBlender等の実アプリでの表示検証、人体フィット、パネル縫合、衣服形状の評価は未実施です。これらは別の合格基準です。

## 次段階

1. パネル、穴、縫い目対応を持つ共通衣服JSONを定義する。
2. 各パネルを厚み付けし、縫合線の対応に基づく3D配置を生成する。
3. 体型寸法/アバターに対する着装プレビューを追加する。
4. FashionDesigner Studioからローカルmesh coreを呼び出し、OBJ/GLBを一連出力する。
5. Atelier/CharacterDesignerからのファイル交換を実画像で検証する。
