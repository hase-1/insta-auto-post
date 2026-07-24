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
