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
