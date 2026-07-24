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
