# Claude Code × Codex 連携 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Code を司令塔として、`/codex` スラッシュコマンドで Codex に作業を委任し、Claude が差分をレビューできる状態を作る。

**Architecture:** Codex CLI を導入し、`codex exec`（非対話・実行役モード）を Claude Code から Bash 経由で呼ぶ。`/codex` コマンドでラップし、委任基準をグローバル CLAUDE.md に明文化する。コマンドと基準は user-level（`~/.claude/`）に置き、全プロジェクトで使えるようにする。

**Tech Stack:** Codex CLI（`@openai/codex`, npm グローバル）/ Claude Code スラッシュコマンド / ChatGPT ログイン認証 / Windows 11 ネイティブ（PowerShell）

**注記:** これはコード機能ではなくツール連携のセットアップのため、各タスクの「テスト」は動作検証コマンドで代替する。認証（`codex login`）はブラウザを開く対話操作のため、ユーザー自身がターミナルで実施する。

---

## ファイル構成

- Create: `~/.claude/commands/codex.md` — `/codex` スラッシュコマンド定義（実行役モード）
- Create/Modify: `~/.claude/CLAUDE.md` — Codex 委任ルールを追記（グローバル）
- 一時ファイル: `codex_test.txt`（サンドボックス検証用、検証後に削除）

パスの実体（Windows）:
- `~/.claude/commands/codex.md` = `C:\Users\hid_h\.claude\commands\codex.md`
- `~/.claude/CLAUDE.md` = `C:\Users\hid_h\.claude\CLAUDE.md`

---

## Task 1: Codex CLI の導入

**Files:** なし（グローバル npm インストール）

- [ ] **Step 1: Codex CLI をインストール**

```bash
npm i -g @openai/codex
```

- [ ] **Step 2: インストール確認（バージョン表示）**

Run:
```bash
codex --version
```
Expected: `codex-cli 0.x.x` のようなバージョン文字列が表示される（エラーなし）。表示されない場合は npm グローバル bin が PATH に通っているか確認する（`npm config get prefix` の bin ディレクトリ）。

---

## Task 2: Codex の認証（ユーザー実施）

**Files:** なし

- [ ] **Step 1: ChatGPT でログイン（ユーザーがターミナルで実施）**

> このステップは Claude ではなくユーザーが自分のターミナルで実行する。ブラウザが開き、ChatGPT アカウントで認可する対話操作のため。

ユーザー実行:
```bash
codex login
```
Expected: ブラウザが開き、ChatGPT でログイン後「successfully logged in」等の表示。

- [ ] **Step 2: 認証と疎通の確認**

Run:
```bash
codex exec --sandbox read-only "Reply with exactly: READY"
```
Expected: 出力に `READY` が含まれる。認証エラー（not logged in 等）が出たら Step 1 に戻る。

---

## Task 3: Windows での実行役サンドボックス・フラグの確定

**Files:** 一時 `codex_test.txt`

目的: Windows ネイティブで Codex がファイル編集できるフラグ（`--full-auto` で足りるか、別フラグが要るか）を実際に確認し、Task 4 のコマンドに反映する。

- [ ] **Step 1: クリーンな作業ツリーを確認**

Run:
```bash
git -C "C:/Users/hid_h/Downloads/インスタグラム自動投稿" status --short
```
Expected: 出力を記録（既存の未コミット変更を後で区別するため）。

- [ ] **Step 2: 実行役モードでファイル作成を試す**

Run（プロジェクトルートで）:
```bash
codex exec --full-auto "Create a file named codex_test.txt in the current directory containing the single line OK"
```
Expected: エラーなく完了。Windows でサンドボックス非対応の警告や失敗が出たら、次を順に試す:
1. `codex exec --sandbox workspace-write --ask-for-approval never "..."`
2. `codex exec --dangerously-bypass-approvals-and-sandbox "..."`（最終手段）
成功したフラグ組み合わせを記録する。

- [ ] **Step 3: ファイルが作成されたか確認**

Run:
```bash
cat "C:/Users/hid_h/Downloads/インスタグラム自動投稿/codex_test.txt"
```
Expected: `OK` が表示される。表示されない場合は Step 2 の別フラグを試す。

- [ ] **Step 4: 検証用ファイルを削除**

Run:
```bash
rm -f "C:/Users/hid_h/Downloads/インスタグラム自動投稿/codex_test.txt"
```
Expected: エラーなし。`git status --short` が Step 1 と同じ状態に戻る。

- [ ] **Step 5: 確定フラグをメモ**

Step 2 で成功したフラグ（例: `--full-auto`）を控える。以降 `<EXEC_FLAGS>` と表記し、Task 4 のコマンド内の `--full-auto` をこの値に置き換える。

---

## Task 4: `/codex` スラッシュコマンドの作成

**Files:**
- Create: `C:\Users\hid_h\.claude\commands\codex.md`

- [ ] **Step 1: commands ディレクトリを作成**

Run:
```bash
mkdir -p "C:/Users/hid_h/.claude/commands"
```
Expected: エラーなし（既存でも可）。

- [ ] **Step 2: コマンドファイルを作成**

Create `C:\Users\hid_h\.claude\commands\codex.md` with:

```markdown
---
description: Codex に作業を委任し、結果の git 差分をレビューする（実行役モード）
argument-hint: [Codexに任せるタスク内容]
allowed-tools: Bash(codex:*), Bash(git status:*), Bash(git diff:*), Bash(git stash:*)
---

あなたは司令塔です。以下のタスクを実行役の Codex に委任し、結果をレビューして報告します。

タスク: $ARGUMENTS

手順:
1. `git status --short` で作業ツリーを確認する。未コミットの変更がある場合は、Codex の差分と混ざることをユーザーに伝え、続行してよいか確認する。
2. Codex に作業させる（実行役モード = ファイル編集可）:
   `codex exec --full-auto "$ARGUMENTS"`
   （Windows のセットアップで別フラグが確定している場合はそれを使う）
3. Codex の標準出力の要点を要約して報告する。
4. `git diff` で Codex の変更を確認し、レビューする: 正しさ、タスク意図との一致、不要・危険な変更がないか。
5. 問題があれば修正または `git checkout -- <file>` で破棄する。最終的な差分を要約してユーザーに報告する。
6. コミットはユーザーが明示的に承認するまで行わない。

読み取り専用（提案・レビューのみ、ファイル非変更）で使いたい場合:
`codex exec --sandbox read-only "$ARGUMENTS"` を実行し、差分レビュー（手順4-5）は省略して、Codex の提案内容だけを報告する。
```

> Step 3（Task 3）で `--full-auto` 以外が確定した場合は、上記コマンド内の `codex exec --full-auto` をその値に置き換えて作成すること。

- [ ] **Step 3: コマンドが認識されるか確認**

Claude Code のセッションで `/` を入力し、`/codex` が候補に出ることを確認する（または新規セッションで `/codex` が使えることを確認）。
Expected: `/codex` が description 付きで一覧に表示される。

---

## Task 5: グローバル CLAUDE.md に委任ルールを追記

**Files:**
- Create/Modify: `C:\Users\hid_h\.claude\CLAUDE.md`

- [ ] **Step 1: 既存のグローバル CLAUDE.md を確認**

Run:
```bash
test -f "C:/Users/hid_h/.claude/CLAUDE.md" && echo EXISTS || echo MISSING
```
Expected: `EXISTS` か `MISSING` のどちらか。EXISTS の場合は末尾に追記、MISSING の場合は新規作成する。

- [ ] **Step 2: 委任ルールを追記/作成**

以下のブロックを `C:\Users\hid_h\.claude\CLAUDE.md` に追記する（既存内容は保持）:

```markdown
## Codex 連携（Claude 司令塔 / Codex 実行役）

Codex CLI が導入済み。次の場合、`/codex <タスク>` で Codex への委任を検討する:
- 詰まったバグの独立したセカンドオピニオンが欲しいとき
- 仕様が明確で自己完結した実装タスクを切り出せるとき（使用量節約・並行作業）
- 別モデルの視点で設計・レビューをしたいとき

委任のルール:
- 委任後は必ず Claude が `git diff` で差分をレビューしてからユーザーに報告する。
- コミットはユーザーの明示的な承認後のみ行う。
- 提案・レビューだけ欲しい場合は read-only モードで呼ぶ（`codex exec --sandbox read-only`）。
```

- [ ] **Step 3: 追記結果を確認**

Run:
```bash
cat "C:/Users/hid_h/.claude/CLAUDE.md"
```
Expected: 上記ブロックが（既存内容の後に）含まれている。

---

## Task 6: エンドツーエンド動作確認（スモークテスト）

**Files:** 一時的なテスト変更（検証後に破棄）

- [ ] **Step 1: 新規セッションで委任を実行**

Claude Code の新規セッションで実行:
```
/codex README.md の末尾に「Codex 連携テスト」という1行を追加して
```
Expected: Claude が `codex exec` を呼び、Codex が README.md を編集。Claude が `git diff` でその1行追加を確認して報告する。

- [ ] **Step 2: 差分がレビューされ報告されたか確認**

Claude の報告に、追加された1行の差分内容が含まれていることを確認する。
Expected: `+ Codex 連携テスト`（または類似）の差分が報告される。

- [ ] **Step 3: テスト変更を破棄**

Run:
```bash
git -C "C:/Users/hid_h/Downloads/インスタグラム自動投稿" checkout -- README.md
```
Expected: README.md が元に戻る（`git status --short` にテスト変更が残らない）。

- [ ] **Step 4: 読み取り専用モードの確認**

Claude Code のセッションで実行:
```
/codex （読み取り専用で）このリポジトリの構成を3行で要約して
```
Expected: Codex が read-only で要約を返し、ファイル変更が発生しない（`git status --short` がクリーンなまま）。

---

## 完了基準

- `/codex <タスク>` で Codex に委任でき、Codex がリポジトリ内で作業する。
- 委任後に Claude が git 差分をレビューしてユーザーに報告する。
- 読み取り専用モードで提案のみ得られる。
- グローバル CLAUDE.md の基準に沿って Claude が委任を判断できる。
