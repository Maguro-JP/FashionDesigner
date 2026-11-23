# AtelIer の拡張・単体のアプリ・ほかの AI サービスから使う口

FashionDesigner は AtelIer のために設計するが、単体のアプリとしても動き、ほかの AI サービスからも使えるように設計する。
使われ方ごとに中身を作り分けると同じ処理が何か所にも分かれて直し漏れが出るので、中身は 1 つにして入口だけを分ける。

## 決まり

| 層 | 中身 |
|---|---|
| 中身の処理 | UI に頼らない部品（Python の関数・クラス）。窓・メニュー・AtelIer を読み込まない |
| 入口 1: AtelIer の拡張 | `extension.json` とメニュー。拡張の置き場（`C:\ProgramData\AtelIer\extensions\fashion_designer\`）に置かれ、AtelIer が読み込む |
| 入口 2: 単体のアプリ | 自分のウィンドウ。AtelIer が無くても起動する（配るのは下の「配る物」の単体の Setup） |
| 入口 3: ほかの AI サービスから使う口 | MCP のサーバーと、コマンドで呼べる口。中身の処理をそのまま呼ぶ |

- 置き場と設定は、どの入口から使っても同じにする。入口ごとに置き場を持つと、同じ人の設定や作った物が入口ごとに分かれるため
- 言葉の模型は共通の置き場 `C:\LLM` に置く
- AtelIer が無くても動き、AtelIer があれば拡張として載る
- 次は私の推測: ほかの AI サービスから使う口は MCP のサーバー（標準入出力で話す形）にし、コマンドの口は `python -m fashion_designer <操作>` で JSON を返す形にして、2 つが同じ操作の一覧を使う

AtelIer の側の決まりは、AtelIer の `docs/knowledge/integration.md` の「拡張の設計」と「インストーラーどうしの連携」。

## AtelIer が統括する（配る物と開発の向き）

AtelIer が 6 つのデザイナーを統括する。開発はデザイナーごとのリポジトリで分担するが、FashionDesigner の開発は AtelIer のためにする
（AtelIer で使われない作り込みは、AtelIer を使う人に届かないため）。AtelIer を使う人は拡張だけを入れ、使う物は AtelIer のタイトルの画面で選ぶ。

配る物は 2 つで、拡張だけの Setup が先、単体の Setup は後に作る。デザイナーごとに Python と PySide6 を持つと、容量がかさみ、同じ物が重なって入るため。

| 配る物 | 中身 | 誰向け |
|---|---|---|
| 拡張だけの Setup | 拡張のコードと、AtelIer の Python に無い依存だけ。AtelIer の Python と PySide6 で動く。小さい | AtelIer を使う人。AtelIer のインストーラーの選べる部品はこちらを入れる |
| 単体の Setup | 自分の Python と PySide6 を持つ | AtelIer を使わない人 |

### 採用し合う

AtelIer と 6 つのデザイナーは、互いの良い所・使える所（部品、画面、検品、手順、試験、配る仕組み）を採用し合い、同じ物を二度作らない（開発の工数を減らすため）。
共通に使える部品（模型の置き場、言葉の模型、検品、設定の保存、作業ファイル、試験の下ごしらえなど）は AtelIer の側に置き、デザイナーはそれを使う。
逆に、デザイナーで出来た良い物は AtelIer に取り込む。今重なっている物と、どちらを採るかの推奨は、AtelIer の `docs/knowledge/integration.md` の「採用し合う物」。

### タイトルの画面に出す物

AtelIer のタイトルの画面に出す名前・絵・一言は、`extension.json` に持たせる。欄の名前と形は私の推測で、AtelIer の側はまだ読まない
（AtelIer は今 `module`・`attr`・`path` だけを読み、ほかの鍵は飛ばす）。

```json
{"module": "fashion_designer.extension", "attr": "EXTENSION", "path": ".",
 "title": {"name": "FashionDesigner", "image": "title.png", "tagline": "（一言）"}}
```

- `title.name`: タイトルの画面に出す名前
- `title.image`: タイトルの画面に出す絵。`extension.json` のあるフォルダーからの道（PNG を私の推測とする）
- `title.tagline`: 名前の下に出す一言

## 今のコードが持っている入口

この表はコードを読んで書いた物で、動かして確かめてはいない。

| 層・入口 | 今 | 根拠 |
|---|---|---|
| 中身の処理 | 一部ある | `server.py` は標準ライブラリだけで動き、`/api/generate` で画像の生成を受ける（AtelIer も PySide6 も読まない）。ただし中身は HTTP の受け口と HTML の画面（`studio.html`、`generate.html` など）の中にあり、Python の関数・クラスとして呼べる部品には分かれていない |
| 入口 1: AtelIer の拡張 | ある（`extension.json` は無い） | `fashion_designer/extension.py`（`FashionExtension`、メニュー「服飾」、Studio を `QWebEngineView` の窓で開く）と `pyproject.toml` の `atelier.extensions` の組。このブランチには `extension.json` も、置き場に入れる Setup.exe の組み方（`packaging/`）も無い |
| 入口 2: 単体のアプリ | 一部ある | `python server.py` で 127.0.0.1:8765 に画面を出せるが、自分のウィンドウでは開かない（URL を出すだけ）。Setup.exe は無い |
| 入口 3: ほかの AI サービスから使う口 | 一部ある | MCP のサーバーは無い。`server.py` の `POST /api/generate` は HTTP で呼べるが、コマンドで呼べる口は無い |

足りない物は、中身の処理を Python の部品に分けること、`extension.json` と置き場に入れる Setup.exe、自分のウィンドウで開く単体のアプリと Setup.exe、MCP のサーバーとコマンドの口。この文書ではコードを変えていない。
