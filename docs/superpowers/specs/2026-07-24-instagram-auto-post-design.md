# Instagram 全自動投稿システム 設計書

作成日: 2026-07-24
対象アカウント: [@hasesan_kigyou_support](https://www.instagram.com/hasesan_kigyou_support/)

## 1. 目的

起業サポートアカウント @hasesan_kigyou_support のカルーセル画像投稿を、
ネタ出し・画像生成・キャプション生成・投稿まで人手を介さず全自動で行う。

## 2. 前提条件（調査済み）

| 項目 | 状況 |
|---|---|
| Instagram アカウント種別 | プロアカウント（カテゴリ: Internet Marketing Service） |
| Facebook ページ連携 | 未連携 |
| 採用 API | Instagram API **with Instagram Login** |
| Facebook ページ要否 | **不要**（Instagram Login 方式のため） |
| 投稿レート上限 | 24時間あたり 100 件（カルーセルは1件としてカウント） |
| 実行環境 | Node.js 24 / npm 11 / git 2.53（ローカル確認済み） |

必要な権限スコープ: `instagram_business_basic`, `instagram_business_content_publish`

## 3. スコープ

### 対象
- カルーセル画像投稿（表紙1枚 + 本文5枚 + CTA1枚 = 計7枚）
- キャプション（固定ブロック + 可変本文 + ハッシュタグ）の自動生成
- cron による定期実行

### 対象外（v1）
- リール（動画）投稿 — 動画の全自動生成は別プロジェクトとして切り出す
- ストーリーズ投稿
- コメント・DM への自動返信
- 投稿前の人間による承認 — **完全自動で運用する**（ユーザー判断により決定）

## 4. 既存デザインの分析結果

### 4.1 画像テンプレート（実投稿から採取）

カルーセル1枚目が全投稿で共通の型を持つ:

- 背景: オレンジのグラデーション（三角形パターン）
- 中央: 白の角丸カード
- カード上部: 赤タグ「IT初心者さん向け」
- 見出し: 黒文字 + オレンジ袋文字による強調（2〜3行）
- 締め: 「5選」などの大きな数字
- 右下: メガネのキャラクターアイコン
- 下部: 「Swipe next ⟶」ボタン

**この規則性から、AI 画像生成ではなく HTML テンプレートへの文字流し込みを採用する。**

理由:
- 日本語の文字組みが崩れない（AI 画像生成の最大の弱点）
- 既存ブランドと 100% 統一される
- 生成コストが 0、結果が決定的で再現可能
- 文字数に応じたフォントサイズ自動調整が可能

### 4.2 キャプションテンプレート（実投稿から採取）

```
@hasesan_kigyou_support ←他の投稿はこちら
※今日のテーマ

／
{テーマ}
＼

{本文 — 可変}

コメントはお気軽に！
お困りごと、お悩みごと、何から始めていいか分からない方はDMください。

この投稿が役に立った！という方は
「いいね」「コメント」「フォロー」
してくださると感激です
↓↓↓
@hasesan_kigyou_support

𓇠𓇠𓇠𓇠𓇠𓇠𓇠𓇠𓇠𓇠

■レビュー      … 固定
■サービス      … 固定
■プロフィール  … 固定
■Instagramの発信内容 … 固定

／
今だけLINE登録で起業に役立つ3大特典プレゼント
＼
...

{ハッシュタグ 15個 — 半固定}
```

可変なのは **テーマ・本文・ハッシュタグ一部** のみ。残りは定数として設定ファイルに持つ。

## 5. アーキテクチャ

### 5.1 パイプライン

```
[1] ネタ出し      themes.js     Claude API + 履歴で重複回避 → {theme, items[5], hook}
        ↓
[2] 画像生成      render.js     HTMLテンプレート → Playwright → PNG ×7 (1080×1080)
        ↓
[3] キャプション  caption.js    Claude API（可変部）+ 固定ブロック合成
        ↓
[4] 画像公開      host.js       git commit & push → raw.githubusercontent.com の公開URL
        ↓
[5] 投稿          instagram.js  Graph API: 各画像をコンテナ化 → カルーセル親作成 → publish
        ↓
[6] 履歴記録      history.json  テーマ・日時・投稿IDを追記
```

### 5.2 モジュール構成

各モジュールは単一の責務を持ち、独立してテスト可能にする。

| ファイル | 責務 | 入力 | 出力 |
|---|---|---|---|
| `src/config.js` | 設定値・固定文言の一元管理 | — | 設定オブジェクト |
| `src/themes.js` | テーマと5項目の生成 | 過去テーマ配列 | `{theme, items[], hook}` |
| `src/caption.js` | キャプション文字列の組み立て | `{theme, items}` | キャプション文字列 |
| `src/render.js` | HTML → PNG 変換 | スライド定義配列 | PNG ファイルパス配列 |
| `src/host.js` | 画像を公開 URL 化 | ローカルパス配列 | 公開 URL 配列 |
| `src/instagram.js` | Graph API クライアント | URL配列 + キャプション | 投稿ID |
| `src/history.js` | 投稿履歴の読み書き | — | 履歴配列 |
| `src/index.js` | 上記の統合実行 | CLI引数 | 終了コード |

`templates/carousel.html` — スライド1枚分の HTML。CSS 変数でテキスト・色を差し替える。

### 5.3 データフロー上の重要な制約

**Instagram Graph API は「公開 HTTP(S) URL の画像」しか受け付けない。**
ローカルファイルの直接アップロードは不可。このため [4] の画像公開ステップが必須になる。

採用方式: 生成した画像を GitHub リポジトリの `public/` 配下に commit & push し、
`https://raw.githubusercontent.com/{owner}/{repo}/main/public/{date}/{n}.png` を渡す。

- 無料、追加サービス不要
- 投稿する画像は元々公開されるものなので、リポジトリが public でも情報漏洩にならない
- `host.js` のインターフェースを `(localPaths) => publicUrls` に保つことで、
  将来 Cloudflare R2 / S3 に差し替える際も他モジュールを変更せずに済む

## 6. 実行環境

**GitHub Actions の cron** で定期実行する。

- ローカル PC の電源状態に依存しない
- 画像ホスティングと同じリポジトリで完結する
- ログ・失敗通知が標準で付く

```yaml
on:
  schedule:
    - cron: '0 3 * * 1,3,5'   # JST 12:00 月・水・金
  workflow_dispatch:           # 手動実行も可能
```

投稿頻度は週3回（月・水・金 正午）を初期値とする。`config.js` と cron 式で変更可能。

## 7. 認証情報の管理

| Secret 名 | 用途 | 取得元 |
|---|---|---|
| `IG_ACCESS_TOKEN` | Instagram 投稿 | Meta for Developers（長期トークン） |
| `IG_USER_ID` | 投稿先アカウント ID | Graph API `/me` |
| `ANTHROPIC_API_KEY` | 文章生成 | console.anthropic.com |

- ローカル開発は `.env`（`.gitignore` 済み）、本番は GitHub Secrets
- **トークンの自動更新**: Instagram の長期トークンは60日で失効する。
  ワークフローに毎回 `refresh_access_token` を呼ぶステップを入れ、
  更新後のトークンを GitHub Secrets に書き戻す（`gh` API 経由）。
  これを怠ると60日後に無言で停止するため、v1 の必須要件とする。

## 8. エラーハンドリング

| 事象 | 対応 |
|---|---|
| Claude API 失敗 | 3回まで指数バックオフでリトライ。最終的に失敗したらジョブを失敗させる |
| 画像生成失敗 | 即座にジョブ失敗。中途半端な画像は投稿しない |
| Graph API のコンテナ作成失敗 | 3回リトライ。全滅なら publish せずに終了（部分投稿を作らない） |
| Graph API の publish 失敗 | リトライ。成功済みコンテナは24時間で自動失効するため後始末不要 |
| トークン失効 | ジョブ失敗 + GitHub Actions の失敗通知メールで検知 |
| レート上限超過 | config の頻度上、到達しない（上限100/日 vs 週3回） |

**部分的な失敗で中途半端な投稿を作らないこと**を最優先とする。
全スライドの生成とアップロードが完了して初めて publish を呼ぶ。

## 9. テスト方針

| レベル | 内容 |
|---|---|
| 単体 | `caption.js` の組み立て、`history.js` の重複判定、`config.js` の検証 |
| 単体（モック） | `instagram.js` を fetch モックでテスト。API 呼び出し順序と引数を検証 |
| 目視 | `--dry-run` で画像とキャプションを生成し、投稿せずローカル出力。既存投稿と並べて比較 |
| 統合 | テスト用 Instagram アカウントへ実投稿（本番アカウントは使わない） |

`--dry-run` フラグは開発中の主力手段とし、本番でも常に使えるよう残す。

## 10. 実装順序

1. プロジェクト初期化（package.json, .gitignore, .env.example）
2. `config.js` — 固定文言をすべて既存投稿から移植
3. `caption.js` + テスト — API 不要なので最初に固める
4. `templates/carousel.html` + `render.js` — 既存投稿と見比べて調整（最も反復が必要）
5. `themes.js` — Claude API 連携
6. `instagram.js` — Graph API 連携（モックテスト）
7. `host.js` + `index.js` — 統合
8. `--dry-run` で通しの目視確認
9. GitHub Actions ワークフロー + Secrets 設定
10. 本番初回投稿

## 11. ユーザー側で必要な作業

Claude が代行できない作業（規約同意・アカウント作成・パスワード入力を含むため）:

- [ ] Meta for Developers で開発者登録・アプリ作成
- [ ] アプリに Instagram プロダクトを追加し、Instagram Login を設定
- [ ] `instagram_business_basic` / `instagram_business_content_publish` の権限承認
- [ ] 長期アクセストークンの発行
- [ ] Anthropic API キーの発行
- [ ] GitHub リポジトリの作成

Claude が画面を開いて手順を指示し、クリックと入力のみユーザーが行う形で進める。

## 12. 既知のリスク

| リスク | 内容 | 緩和策 |
|---|---|---|
| AI 生成内容の品質 | 完全自動のため、不適切・不正確な内容がそのまま公開される | プロンプトに禁止事項（誇大な収益表現、断定的な効果保証など）を明記。テーマ候補を config でホワイトリスト化できる設計にする |
| トークン失効 | 60日で無言停止 | 自動更新ステップを必須実装（§7） |
| デザイン再現度 | HTML でフォントが完全一致しない可能性 | Google Fonts の日本語フォントを使用。初回に既存投稿と並べて調整 |
| Meta の API 仕様変更 | 予告なく破壊的変更が入ることがある | `instagram.js` に API 呼び出しを閉じ込め、影響範囲を局所化 |
