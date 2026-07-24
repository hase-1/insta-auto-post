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

/** 正規表現に埋め込む前にメタ文字を無害化する */
function escapeRegExp(text) {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 見出しの一部をブランド色で強調する。既存投稿は黒とオレンジの2色で
 * 見出しを組んでいるため、強調句を受け取って該当箇所だけ色を変える。
 *
 * 置換は1パスで行う。句ごとに順次置換すると、短い句が既に囲まれた長い句の
 * 内側に再度マッチして span が入れ子になるため。長い句を先に並べることで
 * 重なり合う指定でも長い方が優先される。
 */
function highlight(text, emphasis = []) {
  const html = nl2br(text);
  const phrases = [...new Set(emphasis)]
    .filter(Boolean)
    .map((phrase) => nl2br(phrase))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (!phrases.length) return html;

  const pattern = new RegExp(phrases.map(escapeRegExp).join('|'), 'g');
  return html.replaceAll(pattern, (match) => `<span class="hl">${match}</span>`);
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
    position: relative;
  }
  /* 既存投稿の背景にある三角形パターンを再現する。
     カードの下に敷くだけなので本文の可読性には影響しない */
  .facets { position: absolute; inset: 0; overflow: hidden; }
  .facets i {
    position: absolute;
    display: block;
    background: rgba(255,255,255,.10);
  }
  .facets i:nth-child(1) {
    top: -80px; left: -60px; width: 620px; height: 620px;
    clip-path: polygon(0 0, 100% 0, 0 100%);
  }
  .facets i:nth-child(2) {
    top: 120px; right: -140px; width: 520px; height: 520px;
    clip-path: polygon(100% 0, 100% 100%, 0 40%);
    background: rgba(255,255,255,.07);
  }
  .facets i:nth-child(3) {
    bottom: -120px; left: 40px; width: 560px; height: 560px;
    clip-path: polygon(0 100%, 100% 100%, 20% 0);
    background: rgba(0,0,0,.05);
  }
  .facets i:nth-child(4) {
    bottom: -60px; right: -40px; width: 460px; height: 460px;
    clip-path: polygon(100% 100%, 100% 0, 0 100%);
    background: rgba(255,255,255,.09);
  }
  .card {
    position: relative;
    z-index: 1;
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
          <div class="title" style="font-size:${fitFontSize(slide.title, 76)}px">${highlight(slide.title, slide.emphasis)}</div>
          <div class="count">${escapeHtml(slide.countLabel)}</div>
        </div>
        <div class="swipe">Swipe next ⟶</div>`;

    case 'item':
      return `
        <div class="pager">${String(slide.index).padStart(2, '0')} / ${String(slide.total).padStart(2, '0')}</div>
        <div class="card">
          <div class="num">${String(slide.index).padStart(2, '0')}</div>
          <div class="item-title" style="font-size:${fitFontSize(slide.title, 64)}px">${highlight(slide.title, slide.emphasis)}</div>
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

// カード内側の使える横幅（.card の width から左右 padding を引いた値）
const TEXT_WIDTH = 788;

/**
 * 一番長い行がカード幅に収まる文字サイズを返す。
 * 固定サイズだと長い見出しが途中で折り返して単語が割れるため、
 * 行の長さから逆算する。全角1文字をほぼ1em として見積もる。
 */
function fitFontSize(text, max) {
  const longest = Math.max(...String(text).split('\n').map((line) => line.length), 1);
  return Math.min(max, Math.floor(TEXT_WIDTH / longest));
}

// 背景の三角形パターン。全スライド共通で card の下に敷く
const FACETS = '<div class="facets"><i></i><i></i><i></i><i></i></div>';

/** スライド定義から完全な HTML 文書を作る */
export function pageHtml(slide) {
  const inner = FACETS + bodyFor(slide);
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
