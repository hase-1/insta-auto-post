# Instagram 全自動投稿システム 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** @hasesan_kigyou_support のカルーセル画像投稿を、ネタ出しから公開まで全自動で行うシステムを構築する。

**Architecture:** Claude API がテーマと本文を生成し、それを HTML テンプレートへ流し込んで Playwright が 1080×1080 の JPEG を7枚レンダリングする。画像は GitHub リポジトリへ push して公開 URL 化し、Instagram Graph API（Instagram Login 方式）でカルーセル投稿する。全体を GitHub Actions の cron が週3回実行する。

**Tech Stack:** Node.js 24 (ESM) / Playwright / @anthropic-ai/sdk / node:test (組み込みテストランナー) / GitHub Actions

**設計書:** [docs/superpowers/specs/2026-07-24-instagram-auto-post-design.md](../specs/2026-07-24-instagram-auto-post-design.md)

---

## ファイル構成

| ファイル | 責務 |
|---|---|
| `src/config.js` | 定数と固定文言の一元管理。他モジュールは設定を持たない |
| `src/caption.js` | キャプション文字列の組み立てと文字数検証（純関数） |
| `src/slides.js` | テーマと項目からスライド定義配列を作る（純関数） |
| `src/slide-html.js` | スライド定義 → HTML 文字列（純関数） |
| `src/render.js` | HTML → JPEG。Playwright を使う唯一の場所 |
| `src/history.js` | 投稿履歴の読み書きと重複判定 |
| `src/themes.js` | Claude API 呼び出し。テーマ・本文・5項目を生成 |
| `src/instagram.js` | Graph API クライアント。fetch を注入可能にしてテストする |
| `src/host.js` | 生成画像を git push して公開 URL を返す |
| `src/index.js` | 上記を順に呼ぶオーケストレーション + CLI |
| `test/*.test.js` | node:test による単体テスト |
| `.github/workflows/post.yml` | cron 実行とトークン自動更新 |

**依存の向き:** `index.js` → 各モジュール → `config.js`。逆向きの依存を作らない。

---

## Task 1: プロジェクト初期化

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: package.json を作成**

```json
{
  "name": "instagram-auto-post",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/",
    "post": "node --env-file-if-exists=.env src/index.js",
    "dry": "node --env-file-if-exists=.env src/index.js --dry-run"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.72.0",
    "playwright": "^1.58.0"
  }
}
```

- [ ] **Step 2: .env.example を作成**

```
IG_ACCESS_TOKEN=
IG_USER_ID=
ANTHROPIC_API_KEY=
GITHUB_RAW_BASE=https://raw.githubusercontent.com/OWNER/REPO/main
```

- [ ] **Step 3: .gitignore に追記**

既存の `.gitignore` に以下が含まれていることを確認する。無ければ追記する。

```
node_modules/
.env
out/
```

- [ ] **Step 4: 依存をインストール**

Run: `npm install`
Expected: `node_modules/` が作成され、エラーなく終了する

- [ ] **Step 5: Playwright のブラウザを取得**

Run: `npx playwright install chromium`
Expected: chromium のダウンロードが完了する

- [ ] **Step 6: テストランナーが動くことを確認**

Run: `mkdir test` してから `node --test test/`
Expected: `tests 0` と表示され、終了コード 0

- [ ] **Step 7: コミット**

```bash
git add package.json package-lock.json .env.example .gitignore
git commit -m "chore: プロジェクトを初期化"
```

---

## Task 2: config.js — 固定文言の移植

既存投稿から採取した文言をそのまま定数化する。**創作せず、原文を正確に写すこと。**

**Files:**
- Create: `src/config.js`

- [ ] **Step 1: src/config.js を作成**

```js
// Instagram Graph API（Instagram Login 方式）の定数
export const IG = {
  host: 'https://graph.instagram.com',
  version: 'v25.0',
  captionMaxLength: 2200,
  maxHashtags: 30,
  maxCarouselItems: 10,
};

// 画像の出力仕様。Instagram は JPEG のみ受け付ける
export const IMAGE = {
  size: 1080,
  format: 'jpeg',
  quality: 92,
};

// 既存投稿から採取したブランド定義
export const BRAND = {
  handle: 'hasesan_kigyou_support',
  tag: 'IT初心者さん向け',
  bgFrom: '#FFC24D',
  bgTo: '#F26A21',
  tagBg: '#E8452B',
  accent: '#F26A21',
  cardBg: '#FFFFFF',
  ink: '#1F1F1F',
};

// カルーセルの項目数。表紙 + ITEM_COUNT + CTA = 全スライド数
export const ITEM_COUNT = 5;

// テーマの想定最大長。本文の文字数予算はテーマ生成前に決める必要があるため、
// この長さを先に確保しておく（実際のテーマはこれより短い前提）
export const MAX_THEME_LENGTH = 40;

// 空配列なら AI が自由にテーマを決める。
// 内容を絞りたくなったらここに候補を入れるとその中から選ばせる
export const THEME_HINTS = [];

// 既存投稿のキャプションから採取した固定ブロック
export const CAPTION = {
  header: `@hasesan_kigyou_support ←他の投稿はこちら\n※今日のテーマ`,

  divider: '𓇠𓇠𓇠𓇠𓇠𓇠𓇠𓇠𓇠𓇠',

  cta: `コメントはお気軽に！
お困りごと、お悩みごと、何から始めていいか分からない方はDMください。

この投稿が役に立った！という方は
「いいね」「コメント」「フォロー」
してくださると感激です
↓↓↓
@hasesan_kigyou_support`,

  review: `■レビュー

「まったくの初心者から、オンライン講師デビューできた！」
「どこよりもやさしく教えてくれて、集客できるようになった」

など、嬉しいお声をいただいております。`,

  service: `■サービス

「オンライン起業ITスクール」

❍興味があるけれど何をしたらいいか分からない方
❍起業塾に入ったけれどついていけなかった方
❍基本操作からしっかり身に付けたい方

起業塾よりはるかに手軽な月額制で
各種SNS、ZOOM、決済ツール、集客導線などを
学べるオンラインスクール。

ITが苦手な方、シニアの方にも
1からやさしく教えています。`,

  profile: `■プロフィール

❍ 東京在住
❍ 3年間でIT苦手な女性起業家600名以上を指導
❍ 日本全国だけでなく、海外在住の日本人にも対応
❍ 50代会社員女性を副業や起業で人生を豊かにする
❍ ストアカプラチナバッチ講師・満足度★5`,

  contents: `■Instagramの発信内容

❍ IT初心者が1からオンラインで起業できるような内容
❍ 集客導線の作り方、最短導線の最新情報
❍起業で効果的なパソコンや周辺機器のアドバイス`,

  lineOffer: `／
今だけLINE登録で
起業に役立つ
3大特典プレゼント
＼

プレゼント受け取りはこちら
↓↓↓
@hasesan_kigyou_support`,
};

// 既存投稿から採取したハッシュタグ
export const HASHTAGS = [
  '#起業女子',
  '#起業初心者',
  '#起業女性',
  '#主婦起業',
  '#起業初心者サポート',
  '#起業家女性応援',
  '#オンライン集客法',
  '#在宅ワークママ',
  '#副業始めました',
  '#起業サポート',
  '#起業準備中',
  '#起業ママと繋がりたい',
  '#起業したいママ',
  '#起業家女性',
  '#女性起業家応援',
];

// AI が生成してはいけない表現。themes.js のプロンプトで使う
export const FORBIDDEN = [
  '「必ず稼げる」「確実に」など効果を保証する断定表現',
  '具体的な金額での収益保証（例:「月100万円が確実に稼げます」）',
  '医療・健康・投資に関する助言',
  '他者・他サービスの誹謗中傷',
  '出典のない統計や数値',
];
```

- [ ] **Step 2: 読み込めることを確認**

Run: `node -e "import('./src/config.js').then(m => console.log(m.HASHTAGS.length, m.ITEM_COUNT))"`
Expected: `15 5`

- [ ] **Step 3: コミット**

```bash
git add src/config.js
git commit -m "feat: 既存投稿から採取した固定文言を config に定義"
```

---

## Task 3: caption.js — キャプション組み立て

固定ブロックが長いため、可変本文に使える文字数は限られる。**予算計算と上限検証を必ず実装する。**

**Files:**
- Create: `src/caption.js`
- Test: `test/caption.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`test/caption.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCaption, bodyBudget, assertCaptionValid } from '../src/caption.js';
import { IG, CAPTION } from '../src/config.js';

test('buildCaption はテーマを ／＼ で囲んで含める', () => {
  const caption = buildCaption({ theme: 'テストテーマ', body: '本文' });
  assert.ok(caption.includes('／\nテストテーマ\n＼'));
});

test('buildCaption は本文を含める', () => {
  const caption = buildCaption({ theme: 'T', body: 'これが本文です' });
  assert.ok(caption.includes('これが本文です'));
});

test('buildCaption は固定ブロックをすべて含める', () => {
  const caption = buildCaption({ theme: 'T', body: 'B' });
  for (const key of ['header', 'cta', 'review', 'service', 'profile', 'contents', 'lineOffer']) {
    assert.ok(caption.includes(CAPTION[key]), `${key} が欠落している`);
  }
});

test('buildCaption はハッシュタグを1行ずつ並べる', () => {
  const caption = buildCaption({ theme: 'T', body: 'B', hashtags: ['#a', '#b'] });
  assert.ok(caption.endsWith('#a\n#b'));
});

test('bodyBudget は 2200 文字に収まる正の予算を返す', () => {
  const budget = bodyBudget('テーマ例');
  assert.ok(budget > 0, `予算が正でない: ${budget}`);
  const caption = buildCaption({ theme: 'テーマ例', body: 'あ'.repeat(budget) });
  assert.ok(caption.length <= IG.captionMaxLength, `${caption.length} 文字で上限超過`);
});

test('assertCaptionValid は上限超過で例外を投げる', () => {
  assert.throws(() => assertCaptionValid('あ'.repeat(IG.captionMaxLength + 1)), /2200/);
});

test('assertCaptionValid はハッシュタグ31個で例外を投げる', () => {
  const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join('\n');
  assert.throws(() => assertCaptionValid(tags), /ハッシュタグ/);
});

test('assertCaptionValid は正常なキャプションを通す', () => {
  const caption = buildCaption({ theme: 'T', body: '短い本文' });
  assert.doesNotThrow(() => assertCaptionValid(caption));
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node --test test/caption.test.js`
Expected: FAIL — `Cannot find module '../src/caption.js'`

- [ ] **Step 3: src/caption.js を実装**

```js
import { CAPTION, HASHTAGS, IG } from './config.js';

// 上限ちょうどを狙わないための安全マージン
const SAFETY_MARGIN = 20;

/**
 * 固定ブロックと可変部を組み合わせてキャプション全文を作る。
 * ブロックの順序と区切りは既存投稿の構成に合わせている。
 */
export function buildCaption({ theme, body, hashtags = HASHTAGS }) {
  return [
    CAPTION.header,
    `／\n${theme}\n＼`,
    body,
    CAPTION.cta,
    CAPTION.divider,
    CAPTION.review,
    CAPTION.divider,
    CAPTION.service,
    CAPTION.divider,
    `${CAPTION.profile}\n\n${CAPTION.contents}`,
    CAPTION.divider,
    CAPTION.lineOffer,
    CAPTION.divider,
    hashtags.join('\n'),
  ].join('\n\n');
}

/**
 * 本文に使える文字数を返す。固定ブロックが長いため、
 * 生成前にこの値をプロンプトへ渡して超過を防ぐ。
 */
export function bodyBudget(theme, hashtags = HASHTAGS) {
  const withoutBody = buildCaption({ theme, body: '', hashtags }).length;
  return IG.captionMaxLength - withoutBody - SAFETY_MARGIN;
}

/** 投稿前の最終検証。違反があれば例外を投げて publish を止める。 */
export function assertCaptionValid(caption) {
  if (caption.length > IG.captionMaxLength) {
    throw new Error(
      `キャプションが上限を超過: ${caption.length} 文字 (上限 ${IG.captionMaxLength})`,
    );
  }
  const tagCount = (caption.match(/#[^\s#]+/g) ?? []).length;
  if (tagCount > IG.maxHashtags) {
    throw new Error(`ハッシュタグが多すぎる: ${tagCount} 個 (上限 ${IG.maxHashtags})`);
  }
  return caption;
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `node --test test/caption.test.js`
Expected: PASS — 8 tests passed

- [ ] **Step 5: 実際の本文予算を目視確認**

Run: `node -e "import('./src/caption.js').then(m => console.log('本文予算:', m.bodyBudget('会社員が最速で起業を成功する方法')))"`
Expected: 正の整数が表示される。**この値が 300 未満なら固定ブロックが長すぎるため、`config.js` の `review` または `service` を短縮して再確認する。**

- [ ] **Step 6: コミット**

```bash
git add src/caption.js test/caption.test.js
git commit -m "feat: キャプション組み立てと文字数検証を実装"
```

---

## Task 4: slides.js — スライド定義の組み立て

**Files:**
- Create: `src/slides.js`
- Test: `test/slides.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`test/slides.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSlides } from '../src/slides.js';
import { BRAND } from '../src/config.js';

const items = [
  { title: '項目1', body: '説明1' },
  { title: '項目2', body: '説明2' },
  { title: '項目3', body: '説明3' },
  { title: '項目4', body: '説明4' },
  { title: '項目5', body: '説明5' },
];

test('buildSlides は 表紙 + 項目数 + CTA 枚のスライドを返す', () => {
  const slides = buildSlides({ theme: 'テーマ', items });
  assert.equal(slides.length, items.length + 2);
});

test('先頭は cover スライドでテーマとタグを持つ', () => {
  const [cover] = buildSlides({ theme: 'テーマ', items });
  assert.equal(cover.type, 'cover');
  assert.equal(cover.title, 'テーマ');
  assert.equal(cover.tag, BRAND.tag);
  assert.equal(cover.countLabel, '5選');
});

test('中間は item スライドで 1 始まりの通し番号を持つ', () => {
  const slides = buildSlides({ theme: 'テーマ', items });
  const itemSlides = slides.filter((s) => s.type === 'item');
  assert.equal(itemSlides.length, 5);
  assert.deepEqual(itemSlides.map((s) => s.index), [1, 2, 3, 4, 5]);
  assert.equal(itemSlides[0].title, '項目1');
  assert.equal(itemSlides[4].body, '説明5');
});

test('末尾は cta スライド', () => {
  const slides = buildSlides({ theme: 'テーマ', items });
  assert.equal(slides.at(-1).type, 'cta');
});

test('項目が空なら例外を投げる', () => {
  assert.throws(() => buildSlides({ theme: 'テーマ', items: [] }), /項目/);
});

test('カルーセル上限 10 枚を超えるなら例外を投げる', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ title: `t${i}`, body: `b${i}` }));
  assert.throws(() => buildSlides({ theme: 'テーマ', items: many }), /10/);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node --test test/slides.test.js`
Expected: FAIL — `Cannot find module '../src/slides.js'`

- [ ] **Step 3: src/slides.js を実装**

```js
import { BRAND, IG } from './config.js';

/**
 * テーマと項目からカルーセルのスライド定義を作る。
 * 構成は 表紙 → 各項目 → CTA。既存投稿のカルーセル構成に合わせている。
 */
export function buildSlides({ theme, items }) {
  if (!items?.length) {
    throw new Error('項目が空のためスライドを作成できない');
  }
  const total = items.length + 2;
  if (total > IG.maxCarouselItems) {
    throw new Error(
      `スライドが ${total} 枚でカルーセル上限 ${IG.maxCarouselItems} 枚を超過している`,
    );
  }

  return [
    {
      type: 'cover',
      tag: BRAND.tag,
      title: theme,
      countLabel: `${items.length}選`,
    },
    ...items.map((item, i) => ({
      type: 'item',
      index: i + 1,
      total: items.length,
      title: item.title,
      body: item.body,
    })),
    {
      type: 'cta',
      title: 'まずは無料相談から',
      body: 'プロフィールのLINEから\n3大特典を受け取れます',
      handle: `@${BRAND.handle}`,
    },
  ];
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `node --test test/slides.test.js`
Expected: PASS — 6 tests passed

- [ ] **Step 5: コミット**

```bash
git add src/slides.js test/slides.test.js
git commit -m "feat: スライド定義の組み立てを実装"
```

---

## Task 5: slide-html.js — スライド → HTML

既存デザイン（オレンジのグラデ背景 / 白の角丸カード / 赤タグ / 袋文字 / Swipe next）を再現する。

**Files:**
- Create: `src/slide-html.js`
- Test: `test/slide-html.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`test/slide-html.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { pageHtml, escapeHtml } from '../src/slide-html.js';
import { IMAGE } from '../src/config.js';

test('escapeHtml は HTML 特殊文字を無害化する', () => {
  assert.equal(escapeHtml('<b>&"x"</b>'), '&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;');
});

test('pageHtml は完全な HTML 文書を返す', () => {
  const html = pageHtml({ type: 'cover', tag: 'タグ', title: 'テーマ', countLabel: '5選' });
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('</html>'));
});

test('cover スライドはタグ・タイトル・件数を含む', () => {
  const html = pageHtml({ type: 'cover', tag: 'IT初心者さん向け', title: 'テーマX', countLabel: '5選' });
  assert.ok(html.includes('IT初心者さん向け'));
  assert.ok(html.includes('テーマX'));
  assert.ok(html.includes('5選'));
  assert.ok(html.includes('Swipe next'));
});

test('item スライドは通し番号・タイトル・本文を含む', () => {
  const html = pageHtml({ type: 'item', index: 2, total: 5, title: 'タイトルY', body: '本文Z' });
  assert.ok(html.includes('タイトルY'));
  assert.ok(html.includes('本文Z'));
  assert.ok(html.includes('02'));
});

test('cta スライドはハンドル名を含む', () => {
  const html = pageHtml({ type: 'cta', title: 'T', body: 'B', handle: '@handle' });
  assert.ok(html.includes('@handle'));
});

test('本文中の改行は <br> に変換される', () => {
  const html = pageHtml({ type: 'item', index: 1, total: 5, title: 'T', body: 'あ\nい' });
  assert.ok(html.includes('あ<br>い'));
});

test('タイトルの山括弧はエスケープされる', () => {
  const html = pageHtml({ type: 'item', index: 1, total: 5, title: '<script>', body: 'B' });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('キャンバスサイズが設定値と一致する', () => {
  const html = pageHtml({ type: 'cover', tag: 'a', title: 'b', countLabel: 'c' });
  assert.ok(html.includes(`${IMAGE.size}px`));
});

test('未知のスライド種別は例外を投げる', () => {
  assert.throws(() => pageHtml({ type: 'unknown' }), /unknown/);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node --test test/slide-html.test.js`
Expected: FAIL — `Cannot find module '../src/slide-html.js'`

- [ ] **Step 3: src/slide-html.js を実装**

```js
import { BRAND, IMAGE } from './config.js';

/** HTML への文字列埋め込み前に特殊文字を無害化する */
export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** エスケープしたうえで改行を <br> にする */
function nl2br(text) {
  return escapeHtml(text).replaceAll('\n', '<br>');
}

const STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${IMAGE.size}px;
    height: ${IMAGE.size}px;
    font-family: 'Noto Sans JP', sans-serif;
    color: ${BRAND.ink};
    background: linear-gradient(140deg, ${BRAND.bgFrom} 0%, ${BRAND.bgTo} 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .card {
    width: 900px;
    min-height: 720px;
    background: ${BRAND.cardBg};
    border-radius: 32px;
    padding: 64px 56px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    box-shadow: 0 16px 48px rgba(0,0,0,.14);
  }
  .tag {
    background: ${BRAND.tagBg};
    color: #fff;
    font-size: 40px;
    font-weight: 700;
    padding: 12px 32px;
    border-radius: 10px;
    margin-bottom: 40px;
  }
  .title { font-size: 76px; font-weight: 900; line-height: 1.35; }
  .title .hl { color: ${BRAND.accent}; }
  .count { font-size: 112px; font-weight: 900; margin-top: 24px; }
  .num {
    font-size: 88px; font-weight: 900; color: ${BRAND.accent};
    line-height: 1; margin-bottom: 24px;
  }
  .item-title { font-size: 64px; font-weight: 900; line-height: 1.4; }
  .item-body {
    font-size: 40px; font-weight: 500; line-height: 1.75;
    margin-top: 36px; color: #444;
  }
  .handle { font-size: 44px; font-weight: 700; color: ${BRAND.accent}; margin-top: 40px; }
  .swipe {
    position: absolute; bottom: 56px;
    background: #fff; color: ${BRAND.accent};
    font-size: 32px; font-weight: 700;
    padding: 14px 40px; border-radius: 999px;
  }
  .pager {
    position: absolute; top: 56px; right: 64px;
    color: rgba(255,255,255,.95); font-size: 34px; font-weight: 700;
  }
`;

function bodyFor(slide) {
  switch (slide.type) {
    case 'cover':
      return `
        <div class="card">
          <div class="tag">${escapeHtml(slide.tag)}</div>
          <div class="title">${nl2br(slide.title)}</div>
          <div class="count">${escapeHtml(slide.countLabel)}</div>
        </div>
        <div class="swipe">Swipe next ⟶</div>`;

    case 'item':
      return `
        <div class="pager">${String(slide.index).padStart(2, '0')} / ${String(slide.total).padStart(2, '0')}</div>
        <div class="card">
          <div class="num">${String(slide.index).padStart(2, '0')}</div>
          <div class="item-title">${nl2br(slide.title)}</div>
          <div class="item-body">${nl2br(slide.body)}</div>
        </div>
        <div class="swipe">Swipe next ⟶</div>`;

    case 'cta':
      return `
        <div class="card">
          <div class="title">${nl2br(slide.title)}</div>
          <div class="item-body">${nl2br(slide.body)}</div>
          <div class="handle">${escapeHtml(slide.handle)}</div>
        </div>`;

    default:
      throw new Error(`未知のスライド種別: ${slide.type}`);
  }
}

/** スライド定義から完全な HTML 文書を作る */
export function pageHtml(slide) {
  const inner = bodyFor(slide);
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;700;900&display=swap" rel="stylesheet">
<style>${STYLES}</style>
</head>
<body>${inner}</body>
</html>`;
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `node --test test/slide-html.test.js`
Expected: PASS — 9 tests passed

- [ ] **Step 5: コミット**

```bash
git add src/slide-html.js test/slide-html.test.js
git commit -m "feat: スライドのHTML生成を実装"
```

---

## Task 6: render.js — HTML → JPEG

**Files:**
- Create: `src/render.js`

Playwright の実ブラウザを使うため単体テストではなく、Task 10 の `--dry-run` で目視確認する。

- [ ] **Step 1: src/render.js を実装**

```js
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { pageHtml } from './slide-html.js';
import { IMAGE } from './config.js';

/**
 * スライド定義配列を JPEG ファイル群に変換する。
 * Instagram は JPEG のみ受け付けるため PNG では出力しない。
 * @returns {Promise<string[]>} 生成したファイルの絶対パス（スライド順）
 */
export async function renderSlides(slides, outDir) {
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: IMAGE.size, height: IMAGE.size },
      deviceScaleFactor: 1,
    });

    const files = [];
    for (const [i, slide] of slides.entries()) {
      await page.setContent(pageHtml(slide), { waitUntil: 'networkidle' });
      // Web フォントの読み込み完了を待たないと文字がフォールバックで描画される。
      // document.fonts.ready の解決値は直列化できないため true を返す
      await page.evaluate(() => document.fonts.ready.then(() => true));

      const file = path.join(outDir, `${String(i + 1).padStart(2, '0')}.jpg`);
      await page.screenshot({
        path: file,
        type: IMAGE.format,
        quality: IMAGE.quality,
      });
      files.push(file);
    }
    return files;
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 2: 手動で1枚レンダリングして動作を確認**

Run:
```bash
node -e "import('./src/render.js').then(async m => { const f = await m.renderSlides([{type:'cover',tag:'IT初心者さん向け',title:'会社員が\n最速で起業する方法',countLabel:'5選'}], 'out/smoke'); console.log(f); })"
```
Expected: `out/smoke/01.jpg` が生成される

- [ ] **Step 3: 生成画像を目視で確認**

`out/smoke/01.jpg` を開き、以下を確認する:
- サイズが 1080×1080
- 背景がオレンジのグラデーション
- 白い角丸カードの中に赤タグ・見出し・「5選」がある
- 日本語が豆腐（□）にならず正しく表示されている
- テキストがカードからはみ出していない

**日本語が正しく出ない場合:** Google Fonts の読み込みに失敗している。ネットワークを確認し、それでも駄目なら `assets/fonts/` にフォントを配置して `@font-face` で読み込む方式へ切り替える。

- [ ] **Step 4: コミット**

```bash
git add src/render.js
git commit -m "feat: Playwright によるスライドのJPEG生成を実装"
```

---

## Task 7: history.js — 投稿履歴

**Files:**
- Create: `src/history.js`
- Create: `data/history.json`
- Test: `test/history.test.js`

- [ ] **Step 1: data/history.json を作成**

```json
[]
```

- [ ] **Step 2: 失敗するテストを書く**

`test/history.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadHistory, appendEntry, recentThemes, isDuplicate } from '../src/history.js';

async function tempFile() {
  const dir = await mkdtemp(path.join(tmpdir(), 'hist-'));
  return path.join(dir, 'history.json');
}

test('loadHistory は存在しないファイルで空配列を返す', async () => {
  assert.deepEqual(await loadHistory(await tempFile()), []);
});

test('appendEntry は追記して読み戻せる', async () => {
  const file = await tempFile();
  await appendEntry(file, { theme: 'A', postedAt: '2026-07-24', mediaId: '1' });
  await appendEntry(file, { theme: 'B', postedAt: '2026-07-26', mediaId: '2' });
  const history = await loadHistory(file);
  assert.equal(history.length, 2);
  assert.equal(history[1].theme, 'B');
});

test('appendEntry の書き出しは整形された JSON', async () => {
  const file = await tempFile();
  await appendEntry(file, { theme: 'A', postedAt: '2026-07-24', mediaId: '1' });
  assert.ok((await readFile(file, 'utf8')).includes('\n  '));
});

test('recentThemes は新しい順に指定件数だけ返す', () => {
  const history = [{ theme: 'A' }, { theme: 'B' }, { theme: 'C' }];
  assert.deepEqual(recentThemes(history, 2), ['C', 'B']);
});

test('recentThemes は件数が足りなくても全件返す', () => {
  assert.deepEqual(recentThemes([{ theme: 'A' }], 5), ['A']);
});

test('isDuplicate は前後の空白を無視して一致を検出する', () => {
  const history = [{ theme: 'テーマA' }];
  assert.equal(isDuplicate(history, '  テーマA  '), true);
  assert.equal(isDuplicate(history, 'テーマB'), false);
});
```

- [ ] **Step 3: テストを実行して失敗を確認**

Run: `node --test test/history.test.js`
Expected: FAIL — `Cannot find module '../src/history.js'`

- [ ] **Step 4: src/history.js を実装**

```js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

/** 履歴を読む。ファイルが無ければ空配列を返す（初回実行のため） */
export async function loadHistory(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

/** 履歴を1件追記する */
export async function appendEntry(file, entry) {
  const history = await loadHistory(file);
  history.push(entry);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
  return history;
}

/** 直近のテーマを新しい順に返す。生成時の重複回避に使う */
export function recentThemes(history, count = 20) {
  return history.slice(-count).reverse().map((entry) => entry.theme);
}

/** 同じテーマが既に投稿済みかを判定する */
export function isDuplicate(history, theme) {
  const normalized = theme.trim();
  return history.some((entry) => entry.theme.trim() === normalized);
}
```

- [ ] **Step 5: テストを実行して成功を確認**

Run: `node --test test/history.test.js`
Expected: PASS — 6 tests passed

- [ ] **Step 6: コミット**

```bash
git add src/history.js test/history.test.js data/history.json
git commit -m "feat: 投稿履歴の読み書きと重複判定を実装"
```

---

## Task 8: themes.js — Claude API による生成

**Files:**
- Create: `src/themes.js`

Claude API の tool 定義でスキーマを強制し、パース失敗を防ぐ。

- [ ] **Step 1: src/themes.js を実装**

```js
import Anthropic from '@anthropic-ai/sdk';
import { ITEM_COUNT, FORBIDDEN, THEME_HINTS, MAX_THEME_LENGTH } from './config.js';

const MODEL = 'claude-sonnet-5';

// tool 定義でスキーマを強制する。自由記述の JSON より確実にパースできる
const POST_TOOL = {
  name: 'submit_post',
  description: 'Instagram 投稿の内容を提出する',
  input_schema: {
    type: 'object',
    properties: {
      theme: {
        type: 'string',
        description: `カルーセル表紙の見出し。20〜30文字。体言止め。${MAX_THEME_LENGTH}文字を超えないこと`,
      },
      items: {
        type: 'array',
        minItems: ITEM_COUNT,
        maxItems: ITEM_COUNT,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '項目の見出し。15〜25文字' },
            body: { type: 'string', description: '項目の説明。40〜70文字' },
          },
          required: ['title', 'body'],
        },
      },
      body: {
        type: 'string',
        description: 'キャプション本文。話し言葉で親しみやすく',
      },
    },
    required: ['theme', 'items', 'body'],
  },
};

function buildPrompt({ recent, budget }) {
  return `あなたは「はせさん」というオンライン起業サポートの発信者です。
IT が苦手な初心者、特に 50 代の会社員女性に向けて Instagram で発信しています。

# 依頼
Instagram のカルーセル投稿を1本作ってください。

# 発信者の背景
- 3年間で IT が苦手な女性起業家 600 名以上を指導
- ストアカのプラチナバッジ講師
- 月額制のオンライン起業 IT スクールを運営

# 文体
- 語りかけるような、やさしい話し言葉
- 専門用語を使うときは必ず噛み砕いて説明する
- 押しつけがましくない

# 制約
- theme は表紙の見出しになるため、具体的で興味を引くもの。${MAX_THEME_LENGTH} 文字以内
- items はちょうど ${ITEM_COUNT} 個
- body は ${budget} 文字以内。**必ず守ること**
- 次の表現は禁止:
${FORBIDDEN.map((f) => `  - ${f}`).join('\n')}
${THEME_HINTS.length ? `\n# テーマは次の候補から選ぶこと\n${THEME_HINTS.map((t) => `- ${t}`).join('\n')}` : ''}

# 直近で投稿済みのテーマ（重複させないこと）
${recent.length ? recent.map((t) => `- ${t}`).join('\n') : '（まだ投稿がありません）'}

submit_post ツールで提出してください。`;
}

/**
 * テーマ・5項目・キャプション本文を生成する。
 * @param {object} options
 * @param {string[]} options.recent 直近の投稿テーマ（重複回避用）
 * @param {number} options.budget キャプション本文に使える最大文字数
 * @param {Anthropic} [options.client] テスト時に差し替える
 */
export async function generateContent({ recent, budget, client }) {
  const anthropic = client ?? new Anthropic();

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [POST_TOOL],
    tool_choice: { type: 'tool', name: 'submit_post' },
    messages: [{ role: 'user', content: buildPrompt({ recent, budget }) }],
  });

  const toolUse = message.content.find((block) => block.type === 'tool_use');
  if (!toolUse) {
    throw new Error('Claude が submit_post ツールを呼ばなかった');
  }

  const result = toolUse.input;
  if (result.items?.length !== ITEM_COUNT) {
    throw new Error(`項目数が ${result.items?.length} 個。${ITEM_COUNT} 個であるべき`);
  }
  if (result.body.length > budget) {
    throw new Error(`本文が ${result.body.length} 文字で予算 ${budget} 文字を超過`);
  }
  if (result.theme.length > MAX_THEME_LENGTH) {
    throw new Error(`テーマが ${result.theme.length} 文字で上限 ${MAX_THEME_LENGTH} 文字を超過`);
  }
  return result;
}
```

- [ ] **Step 2: 動作確認（要 ANTHROPIC_API_KEY）**

Run:
```bash
node --env-file-if-exists=.env -e "import('./src/themes.js').then(async m => console.log(JSON.stringify(await m.generateContent({recent:[], budget:400}), null, 2)))"
```
Expected: `theme` / `items`（5個）/ `body` を持つ JSON が表示される

**API キーが未取得の場合はこの Step をスキップし、Task 11 の設定完了後に実施する。**

- [ ] **Step 3: コミット**

```bash
git add src/themes.js
git commit -m "feat: Claude API によるテーマと本文の生成を実装"
```

---

## Task 9: instagram.js — Graph API クライアント

**Files:**
- Create: `src/instagram.js`
- Test: `test/instagram.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`test/instagram.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstagramClient } from '../src/instagram.js';

/** 呼び出し URL を記録しつつ固定レスポンスを返す fetch のモック */
function mockFetch(responses) {
  const calls = [];
  const queue = [...responses];
  const fn = async (url, options) => {
    calls.push({ url: String(url), options });
    const next = queue.shift() ?? { ok: true, body: {} };
    return {
      ok: next.ok,
      status: next.ok ? 200 : 400,
      json: async () => next.body,
      text: async () => JSON.stringify(next.body),
    };
  };
  fn.calls = calls;
  return fn;
}

function client(fetchImpl) {
  return createInstagramClient({ token: 'TOKEN', userId: '123', fetchImpl });
}

test('createCarouselItem は is_carousel_item=true でコンテナIDを返す', async () => {
  const fetchImpl = mockFetch([{ ok: true, body: { id: 'ITEM1' } }]);
  const id = await client(fetchImpl).createCarouselItem('https://example.com/a.jpg');

  assert.equal(id, 'ITEM1');
  const { url } = fetchImpl.calls[0];
  assert.ok(url.includes('/123/media'));
  assert.ok(url.includes('is_carousel_item=true'));
  assert.ok(url.includes(encodeURIComponent('https://example.com/a.jpg')));
  assert.equal(fetchImpl.calls[0].options.method, 'POST');
});

test('createCarousel は children と media_type=CAROUSEL を送る', async () => {
  const fetchImpl = mockFetch([{ ok: true, body: { id: 'PARENT' } }]);
  const id = await client(fetchImpl).createCarousel(['A', 'B'], 'キャプション');

  assert.equal(id, 'PARENT');
  const { url } = fetchImpl.calls[0];
  assert.ok(url.includes('media_type=CAROUSEL'));
  assert.ok(url.includes(`children=${encodeURIComponent('A,B')}`));
  assert.ok(url.includes(encodeURIComponent('キャプション')));
});

test('publish は media_publish に creation_id を送る', async () => {
  const fetchImpl = mockFetch([{ ok: true, body: { id: 'MEDIA' } }]);
  const id = await client(fetchImpl).publish('PARENT');

  assert.equal(id, 'MEDIA');
  const { url } = fetchImpl.calls[0];
  assert.ok(url.includes('/123/media_publish'));
  assert.ok(url.includes('creation_id=PARENT'));
});

test('refreshToken は ig_refresh_token を使い新トークンを返す', async () => {
  const fetchImpl = mockFetch([{ ok: true, body: { access_token: 'NEW', expires_in: 5184000 } }]);
  const result = await client(fetchImpl).refreshToken();

  assert.equal(result.access_token, 'NEW');
  const { url } = fetchImpl.calls[0];
  assert.ok(url.includes('refresh_access_token'));
  assert.ok(url.includes('grant_type=ig_refresh_token'));
});

test('API エラー時は本文を含む例外を投げる', async () => {
  const fetchImpl = mockFetch([{ ok: false, body: { error: { message: 'トークン無効' } } }]);
  await assert.rejects(() => client(fetchImpl).publish('X'), /トークン無効/);
});

test('アクセストークンが例外メッセージに露出しない', async () => {
  const fetchImpl = mockFetch([{ ok: false, body: { error: { message: 'boom' } } }]);
  await assert.rejects(
    () => client(fetchImpl).publish('X'),
    (error) => !error.message.includes('TOKEN'),
  );
});

test('カルーセル上限を超える children で例外を投げる', async () => {
  const many = Array.from({ length: 11 }, (_, i) => `C${i}`);
  await assert.rejects(() => client(mockFetch([])).createCarousel(many, 'c'), /10/);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node --test test/instagram.test.js`
Expected: FAIL — `Cannot find module '../src/instagram.js'`

- [ ] **Step 3: src/instagram.js を実装**

```js
import { IG } from './config.js';

/**
 * Instagram Graph API（Instagram Login 方式）のクライアント。
 * API 呼び出しをこのファイルに閉じ込め、仕様変更の影響を局所化する。
 */
export function createInstagramClient({
  token,
  userId,
  fetchImpl = globalThis.fetch,
  host = IG.host,
  version = IG.version,
}) {
  if (!token) throw new Error('IG_ACCESS_TOKEN が未設定');
  if (!userId) throw new Error('IG_USER_ID が未設定');

  async function call(pathname, params, { versioned = true, method = 'POST' } = {}) {
    const base = versioned ? `${host}/${version}${pathname}` : `${host}${pathname}`;
    const url = new URL(base);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set('access_token', token);

    const response = await fetchImpl(url, { method });
    const payload = await response.json();

    if (!response.ok) {
      // トークンを含む URL は決してログへ出さない
      const detail = payload?.error?.message ?? JSON.stringify(payload);
      throw new Error(`Instagram API エラー (${response.status}): ${detail}`);
    }
    return payload;
  }

  return {
    /** カルーセルの1枚分のコンテナを作る */
    async createCarouselItem(imageUrl) {
      const { id } = await call(`/${userId}/media`, {
        image_url: imageUrl,
        is_carousel_item: 'true',
      });
      return id;
    },

    /** 子コンテナをまとめる親コンテナを作る */
    async createCarousel(childIds, caption) {
      if (childIds.length > IG.maxCarouselItems) {
        throw new Error(
          `カルーセルの枚数が ${childIds.length} 枚で上限 ${IG.maxCarouselItems} 枚を超過`,
        );
      }
      const { id } = await call(`/${userId}/media`, {
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption,
      });
      return id;
    },

    /** 親コンテナを公開する。ここまで来て初めて投稿が世に出る */
    async publish(creationId) {
      const { id } = await call(`/${userId}/media_publish`, { creation_id: creationId });
      return id;
    },

    /** 長期トークンを更新する。60日で失効するため定期実行が必須 */
    async refreshToken() {
      return call(
        '/refresh_access_token',
        { grant_type: 'ig_refresh_token' },
        { versioned: false, method: 'GET' },
      );
    },
  };
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `node --test test/instagram.test.js`
Expected: PASS — 7 tests passed

- [ ] **Step 5: 全テストを実行**

Run: `npm test`
Expected: PASS — すべてのテストが通る

- [ ] **Step 6: コミット**

```bash
git add src/instagram.js test/instagram.test.js
git commit -m "feat: Instagram Graph API クライアントを実装"
```

---

## Task 10: host.js + index.js — 画像公開と統合

**Files:**
- Create: `src/host.js`
- Create: `src/index.js`

- [ ] **Step 1: src/host.js を実装**

```js
import { execFile } from 'node:child_process';
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * 生成画像をリポジトリへ commit & push し、公開 URL を返す。
 * Instagram Graph API は公開 HTTP(S) URL の画像しか受け付けないため必要。
 *
 * 戻り値のインターフェースを (files) => urls に保っているので、
 * 将来 Cloudflare R2 や S3 へ差し替える際も他モジュールの変更は不要。
 */
export async function publishImages({ files, repoDir, rawBase, slug, branch = 'main' }) {
  if (!rawBase) throw new Error('GITHUB_RAW_BASE が未設定');

  const destDir = path.join(repoDir, 'public', slug);
  await mkdir(destDir, { recursive: true });

  const urls = [];
  for (const file of files) {
    const name = path.basename(file);
    await cp(file, path.join(destDir, name));
    urls.push(`${rawBase.replace(/\/$/, '')}/public/${slug}/${name}`);
  }

  await run('git', ['add', path.posix.join('public', slug)], { cwd: repoDir });
  await run('git', ['commit', '-m', `chore: ${slug} の投稿画像を追加`], { cwd: repoDir });
  await run('git', ['push', 'origin', branch], { cwd: repoDir });

  return urls;
}
```

- [ ] **Step 2: src/index.js を実装**

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';

import { buildCaption, bodyBudget, assertCaptionValid } from './caption.js';
import { buildSlides } from './slides.js';
import { renderSlides } from './render.js';
import { generateContent } from './themes.js';
import { createInstagramClient } from './instagram.js';
import { publishImages } from './host.js';
import { loadHistory, appendEntry, recentThemes, isDuplicate } from './history.js';
import { MAX_THEME_LENGTH } from './config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HISTORY_FILE = path.join(ROOT, 'data', 'history.json');

/** 一時的な障害に対して指数バックオフで再試行する */
async function retry(label, fn, attempts = 3) {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`[retry] ${label} が失敗 (${i}/${attempts}): ${error.message}`);
      if (i < attempts) await new Promise((r) => setTimeout(r, 2 ** i * 1000));
    }
  }
  throw new Error(`${label} が ${attempts} 回失敗: ${lastError.message}`);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const slug = new Date().toISOString().slice(0, 10);
  const outDir = path.join(ROOT, 'out', slug);

  // 1. ネタ出し
  const history = await loadHistory(HISTORY_FILE);
  // テーマが決まる前に予算を渡す必要があるため、想定最大長のテーマで見積もる
  const budget = bodyBudget('あ'.repeat(MAX_THEME_LENGTH));
  const content = await retry('テーマ生成', () =>
    generateContent({ recent: recentThemes(history, 20), budget }),
  );
  if (isDuplicate(history, content.theme)) {
    throw new Error(`テーマが過去と重複している: ${content.theme}`);
  }
  console.log(`テーマ: ${content.theme}`);

  // 2. キャプション組み立て（投稿前に必ず検証する）
  const caption = assertCaptionValid(
    buildCaption({ theme: content.theme, body: content.body }),
  );
  console.log(`キャプション: ${caption.length} 文字`);

  // 3. 画像生成
  const slides = buildSlides({ theme: content.theme, items: content.items });
  const files = await renderSlides(slides, outDir);
  console.log(`画像を ${files.length} 枚生成: ${outDir}`);

  if (dryRun) {
    await writeFile(path.join(outDir, 'caption.txt'), caption, 'utf8');
    console.log('--dry-run のため投稿はしない。画像とキャプションを out/ に出力した');
    return;
  }

  // 4. 画像を公開 URL 化
  const urls = await publishImages({
    files,
    repoDir: ROOT,
    rawBase: process.env.GITHUB_RAW_BASE,
    slug,
  });

  // 5. 投稿。全コンテナが揃ってから publish し、中途半端な投稿を作らない
  const ig = createInstagramClient({
    token: process.env.IG_ACCESS_TOKEN,
    userId: process.env.IG_USER_ID,
  });

  const childIds = [];
  for (const url of urls) {
    childIds.push(await retry(`コンテナ作成 ${url}`, () => ig.createCarouselItem(url)));
  }
  const parentId = await retry('カルーセル作成', () => ig.createCarousel(childIds, caption));
  const mediaId = await retry('公開', () => ig.publish(parentId));
  console.log(`投稿完了: ${mediaId}`);

  // 6. 履歴を記録
  await appendEntry(HISTORY_FILE, {
    theme: content.theme,
    postedAt: new Date().toISOString(),
    mediaId,
  });
}

main().catch((error) => {
  console.error(`失敗: ${error.message}`);
  process.exitCode = 1;
});
```

- [ ] **Step 3: 全テストを実行**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: --dry-run で通しの動作を確認（要 ANTHROPIC_API_KEY）**

Run: `npm run dry`
Expected: `out/YYYY-MM-DD/` に `01.jpg`〜`07.jpg` と `caption.txt` が生成される

- [ ] **Step 5: 生成物を既存投稿と見比べる**

`out/YYYY-MM-DD/01.jpg` と実際の投稿を並べて確認する:
- 色・レイアウト・フォントの太さが既存投稿と揃っているか
- 文字がカードからはみ出していないか
- `caption.txt` が既存キャプションと同じ構成になっているか

**ずれがあれば `src/slide-html.js` の `STYLES` を調整して Step 4 から繰り返す。**

- [ ] **Step 6: コミット**

```bash
git add src/host.js src/index.js
git commit -m "feat: 画像の公開URL化と全体の統合を実装"
```

---

## Task 11: GitHub Actions — 定期実行とトークン自動更新

**Files:**
- Create: `.github/workflows/post.yml`

- [ ] **Step 1: ワークフローを作成**

```yaml
name: Instagram 自動投稿

on:
  schedule:
    # JST 12:00 (UTC 03:00) 月・水・金
    - cron: '0 3 * * 1,3,5'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  post:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: npm

      - run: npm ci
      - run: npx playwright install --with-deps chromium

      - name: git の投稿者を設定
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: 投稿
        env:
          IG_ACCESS_TOKEN: ${{ secrets.IG_ACCESS_TOKEN }}
          IG_USER_ID: ${{ secrets.IG_USER_ID }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_RAW_BASE: https://raw.githubusercontent.com/${{ github.repository }}/main
        run: node src/index.js

      - name: 履歴をコミット
        run: |
          git add data/history.json
          git diff --staged --quiet || git commit -m "chore: 投稿履歴を更新"
          git push

  # トークンは60日で失効する。定期的に更新しないと無言で停止する。
  # トークンは発行から24時間経たないと更新できないため、
  # 手動実行(workflow_dispatch)では走らせずスケジュール時のみ実行する
  refresh-token:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: アクセストークンを更新
        env:
          IG_ACCESS_TOKEN: ${{ secrets.IG_ACCESS_TOKEN }}
          GH_TOKEN: ${{ secrets.GH_PAT }}
        run: |
          NEW_TOKEN=$(curl -sf "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${IG_ACCESS_TOKEN}" | jq -r '.access_token')
          if [ -z "$NEW_TOKEN" ] || [ "$NEW_TOKEN" = "null" ]; then
            echo "トークン更新に失敗した"
            exit 1
          fi
          gh secret set IG_ACCESS_TOKEN --body "$NEW_TOKEN"
```

- [ ] **Step 2: cron 式の妥当性を確認**

Run: `node -e "console.log(new Date('2026-07-27T03:00:00Z').toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}))"`
Expected: `2026/7/27 12:00:00` — JST 正午になっている

- [ ] **Step 3: コミット**

```bash
git add .github/workflows/post.yml
git commit -m "ci: 定期投稿とトークン自動更新のワークフローを追加"
```

---

## Task 12: 認証情報の設定と初回投稿

このタスクはユーザーの操作が必要。Claude は画面を開いて手順を指示し、クリックと入力はユーザーが行う。

- [ ] **Step 1: Meta for Developers でアプリを作成**

https://developers.facebook.com/apps/ を開き、「アプリを作成」→ ユースケースで **「Instagram」** を選択する。

- [ ] **Step 2: Instagram Login を設定**

アプリのダッシュボード → Instagram → 「API設定」で、
`instagram_business_basic` と `instagram_business_content_publish` を追加する。

- [ ] **Step 3: 長期アクセストークンを発行**

アプリダッシュボードの「Instagramアカウントを追加」から @hasesan_kigyou_support を接続し、
生成されたトークンをコピーする（App Dashboard 発行のトークンは60日有効）。

- [ ] **Step 4: Instagram ユーザー ID を取得**

Run:
```bash
curl "https://graph.instagram.com/v25.0/me?fields=user_id,username&access_token=<TOKEN>"
```
Expected: `{"user_id":"...","username":"hasesan_kigyou_support"}`

- [ ] **Step 5: Anthropic API キーを発行**

https://console.anthropic.com/settings/keys で新しいキーを作成する。

- [ ] **Step 6: .env を作成してローカルで dry-run**

`.env.example` をコピーして `.env` を作り、取得した値を入れる。

Run: `npm run dry`
Expected: `out/YYYY-MM-DD/` に画像7枚と `caption.txt` が生成される

- [ ] **Step 7: GitHub リポジトリを作成して push**

public リポジトリを作成し、リモートを設定して push する。
（投稿画像は元々公開されるものなので public で問題ない）

- [ ] **Step 8: GitHub Secrets を登録**

リポジトリの Settings → Secrets and variables → Actions で登録する:
`IG_ACCESS_TOKEN` / `IG_USER_ID` / `ANTHROPIC_API_KEY` / `GH_PAT`

`GH_PAT` は Secrets を書き換えるための Personal Access Token（スコープ: `repo`）。
トークン自動更新に必要。

- [ ] **Step 9: 手動実行で初回投稿**

GitHub の Actions タブ →「Instagram 自動投稿」→ Run workflow で手動実行する。

Expected: ジョブが成功し、@hasesan_kigyou_support に新しいカルーセル投稿が公開される

- [ ] **Step 10: 投稿結果を確認**

Instagram を開き、画像7枚とキャプションが意図どおりに公開されているか確認する。
問題があれば投稿を削除し、該当モジュールを修正して再実行する。

---

## 完了条件

- [ ] `npm test` が全件通る
- [ ] `npm run dry` で画像7枚とキャプションが生成され、既存投稿とデザインが揃っている
- [ ] GitHub Actions の手動実行で実際に投稿が公開される
- [ ] cron による自動実行が次回スケジュールで動作する
- [ ] トークン更新ジョブが成功し、Secrets が書き換わる
