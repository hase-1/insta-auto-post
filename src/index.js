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
    buildCaption({ theme: content.theme.replaceAll('\n', ''), body: content.body }),
  );
  console.log(`キャプション: ${caption.length} 文字`);

  // 3. 画像生成
  const slides = buildSlides({
    theme: content.theme,
    items: content.items,
    emphasis: content.emphasis,
  });
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
