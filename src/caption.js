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
