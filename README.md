# インスタグラム自動投稿

@hasesan_kigyou_support（IT が苦手な初心者向けの起業サポート発信）向けの、Instagram カルーセル投稿を自動生成・自動投稿するツール。Claude にテーマ・項目・キャプション本文を考えさせ、Playwright でスライド画像を作り、GitHub 経由で公開 URL 化した上で Instagram Graph API から投稿する。

## セットアップ

`.env.example` を `.env` にコピーし、以下の4つを設定する。

| 変数名 | 入手元 |
| --- | --- |
| `IG_ACCESS_TOKEN` | Meta アプリの「Instagram API の設定」画面。`hasesan_kigyou_support` の「トークンを生成」で発行される文字列 |
| `IG_USER_ID` | 同じ画面のアカウント名の下に表示される数字（`17841...` で始まる） |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys で発行したキー |
| `GITHUB_RAW_BASE` | このリポジトリを GitHub に作成した後の `https://raw.githubusercontent.com/OWNER/REPO/main` |

## コマンド

```bash
npm test      # テスト実行
npm run dry   # 投稿はせず、画像とキャプションを out/ に出力して確認する
npm run post  # 実際に投稿する
```

## 投稿スケジュール

`.github/workflows/post.yml` の `post` ジョブが GitHub Actions 上で自動実行される。既定は JST 月・水・金の 12:00（cron は UTC 基準のため `0 3 * * 1,3,5`）。手動実行したい場合は Actions タブから `workflow_dispatch` を叩く。

スケジュールを変えるには `on.schedule` の cron 式を書き換える。UTC で書く必要がある点に注意（JST = UTC+9）。

## CI に必要な GitHub Secrets

- `IG_ACCESS_TOKEN`
- `IG_USER_ID`
- `ANTHROPIC_API_KEY`
- `GH_PAT` — `repo` スコープを持つ Personal Access Token。ワークフローが `IG_ACCESS_TOKEN` シークレット自体を書き換えるために必要（既定の `GITHUB_TOKEN` にはシークレットの更新権限がない）

## 注意: アクセストークンは60日で失効する

`IG_ACCESS_TOKEN` は発行から60日で自動的に失効する。`.github/workflows/post.yml` の `refresh-token` ジョブが投稿のたびにトークンを更新し、シークレットへ書き戻すことでこれを防いでいる。

**この `refresh-token` ジョブが無効化されている、または `GH_PAT` シークレットが設定されていない場合、60日後に投稿が無言で止まる。** エラー通知は出ない（Instagram 側が単にトークンを拒否するだけ）ので、定期的に Actions の実行履歴を確認することを推奨する。
