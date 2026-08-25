# CLAUDE.md — Instagram 自動投稿システム

このファイルは Claude Code が自動で読み込む「取扱説明書」です。
このリポジトリでユーザー（多くは Claude Code 初心者）を助けるとき、まずここを読んでください。

## このプロジェクトは何か

Instagram のカルーセル画像投稿を全自動で行うシステム。
対象アカウントは起業サポート系（例: @hasesan_kigyou_support）。
**キュー方式**で動く。事前に作った投稿を `queue/` に貯めておき、
GitHub Actions が週3回（月・水・金 12:00 JST）に次の1本を自動投稿する。

## 仕組み（データフロー）

1. `queue/<id>/` に画像7枚（`01.jpg`〜`07.jpg`）と `caption.txt` をコミットしておく
2. cron が `src/post-from-queue.js` を実行 → 未投稿の先頭を選ぶ
3. コミット済み画像の公開URL（`raw.githubusercontent.com/.../queue/<id>/NN.jpg`）を組み立て
4. Instagram Graph API（Instagram Login 方式）でカルーセル投稿
5. `data/history.json` に `queueId` を記録（次回以降スキップ）

画像は `src/slide-html.js`（HTMLテンプレート）＋ `src/render.js`（Playwright）で生成する。
**AI画像生成は使わない**（日本語が崩れず、ブランドが統一され、無料）。
**文章生成もCIでは使わない**（在庫は Claude がセッション内で作ってコミットする）。

## よく頼まれる作業と、やり方

### 在庫を補充する（最頻出）
既存テーマと重複しない投稿を8本ほど生成して `queue/` に追加し、push する。
1. `data/history.json` と `queue/` を見て投稿済み・既存テーマを把握（重複回避）
2. 各投稿は `{ id, theme(\nで2行), emphasis(themeの部分文字列), items[5]{title,body}, body }` を定義
3. `buildSlides` → `renderSlides` で画像、`buildCaption` でキャプションを生成し
   `queue/<NNN>-<slug>/` に `01〜07.jpg` + `caption.txt` を出力
4. `git add queue/ && commit && push`
参考実装のパターンは過去のセッションで使った生成スクリプトと同じ。

### 状態を確認する
```
node src/check-queue.js          # キュー残数（残り3本以下で exit 1）
git pull                          # Actions が history.json を更新するので先に pull
```
GitHub Actions の実行履歴は `gh run list --repo <owner>/<repo> --workflow post.yml`。
`gh` は `GH_TOKEN` 環境変数に PAT を入れて使う（`gh auth login --with-token` は read:org を要求して失敗する）。

### テスト投稿する / 今すぐ投稿する
```
gh workflow run post.yml --repo <owner>/<repo>   # 次の1本を投稿
```
ローカルから直接投稿するスクリプトを書く場合は `src/post-from-queue.js` を `node --env-file=.env` で実行。

### トークンを作り直す（PAT失効時など）
Meta のトークンは60日、GitHub PAT はユーザー設定の期限（例: 90日）で失効する。
失効したら該当トークンを再発行し、`.env` に貼ってもらい、`gh secret set` で登録し直す。

## 絶対に忘れてはいけない落とし穴

- **Instagram が受け付ける画像は JPEG のみ**（PNG不可）。`IMAGE.format = 'jpeg'`。
- **リポジトリは public 必須**。private だと Instagram が画像を取得できず投稿失敗。
- **カルーセル親コンテナは作成直後 IN_PROGRESS**。`publish` 前に FINISHED を待つ
  （`instagram.js` の `waitUntilReady` で対応済み）。待たないと "Media ID is not available"。
- **GitHub Secrets が無いと全実行が失敗する**（IG_ACCESS_TOKEN / IG_USER_ID が必須）。
  これが未登録なのに気づかず「なぜか失敗する」となりがち。まず `gh secret list` を疑う。
- **在庫切れで投稿が止まる**。失敗が10秒程度で終わるならパイプラインは正常で、単に
  `queue/` が空なだけ。→ 在庫補充で直る。
- **キャプションは 2200 文字・ハッシュタグ 30 個まで**。`assertCaptionValid` で検証済み。
- パスに日本語が含まれるため `node --test test/` は失敗する。テストは `npm test`
  （`node --test "test/*.test.js"`）を使う。

## Claude が代われない作業（人間にやってもらう）

- Instagram / Meta / GitHub への**ログイン（パスワード入力）**
- OAuth の「**許可**」ボタン、規約への**同意**、**アカウント作成**
- **Instagramテスター招待の承認**（Instagramアプリ側で本人が承認。忘れると
  「開発者の役割が不十分」で詰まる。初回セットアップ最大の難所）
- トークン・APIキー・PAT の**値の貼り付け**（`.env` へ。チャットには貼らせない）

これらの場面では画面を開いて「ここを押してください」と1ステップずつ案内すること。

## 初心者をセットアップから案内するとき

初回セットアップの完全な手順（プロンプト例つき・約1時間）は
[docs/Instagram自動投稿_1時間セットアップ手順.md](docs/Instagram自動投稿_1時間セットアップ手順.md) にある。
新規メンバーを案内するときはこのドキュメントの流れに沿って進める。

## セキュリティ

- `.env`（トークン・PAT・APIキー）は `.gitignore` 済み。**絶対にコミットしない**。
  public リポジトリなので、うっかりコミットは即座に認証情報漏洩になる。
- エラーメッセージにトークンを含むURLを出さない（`instagram.js` で対応済み）。

## 主要ファイル

| ファイル | 役割 |
|---|---|
| `src/config.js` | 定数・固定文言・ブランド定義（投稿するアカウントに合わせて変える） |
| `src/queue.js` | キューの列挙・未投稿選択・読み込み |
| `src/post-from-queue.js` | キューから1本投稿する統合スクリプト（CIが実行） |
| `src/check-queue.js` | 在庫チェック（残り3本以下で失敗→通知メール） |
| `src/slide-html.js` / `src/render.js` | 画像生成（HTML→JPEG） |
| `src/instagram.js` | Graph API クライアント（投稿・トークン更新） |
| `src/caption.js` | キャプション組み立て・文字数検証 |
| `.github/workflows/post.yml` | 週3回の自動投稿＋トークン自動更新 |
| `.github/workflows/queue-check.yml` | 毎週日曜の在庫チェック（通知） |
