# study-assistant
作りたいもの
- pdfや画像を投げたら、vectorサーチのDBに保存して、テスト問題を作成するwebアプリケーション



## 環境構築
- root配下に.envを作成する
```.env
OPENAI_API_KEY=ここにOpenAIのAPIKeyを入れる
```



### vector Searchを使ってみる

- app
  - ルーティングやqueryに関する処理のみ
- features
  - components
    - view関連hooksから撮ってくる処理のみで、責務は描画のみ
  - hooks
    - ロジック関連を書く場所、
  - type
    - 型をおく

