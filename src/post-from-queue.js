import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertCaptionValid } from './caption.js';
import { createInstagramClient } from './instagram.js';
import { waitUntilReachable } from './host.js';
import { loadHistory, appendEntry } from './history.js';
import { listQueue, nextUnposted, loadQueueItem } from './queue.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HISTORY_FILE = path.join(ROOT, 'data', 'history.json');
const QUEUE_DIR = path.join(ROOT, 'queue');

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
  const rawBase = process.env.GITHUB_RAW_BASE;
  if (!rawBase) throw new Error('GITHUB_RAW_BASE が未設定');

  // 1. キューから次の未投稿を選ぶ
  const history = await loadHistory(HISTORY_FILE);
  const queue = await listQueue(QUEUE_DIR);
  const item = nextUnposted(queue, history);

  if (!item) {
    // 在庫切れ。投稿すべきものが無いのは異常なので、気づけるように失敗させる
    throw new Error(
      `キューに未投稿の投稿がない（queue/ に投稿を追加してください）。総数: ${queue.length}`,
    );
  }
  console.log(`次の投稿: ${item.id}`);

  // 2. 画像とキャプションを読み込む。画像はリポジトリにコミット済み
  const { files, caption: rawCaption } = await loadQueueItem(item);
  const caption = assertCaptionValid(rawCaption);
  console.log(`画像 ${files.length} 枚 / キャプション ${caption.length} 文字`);

  // 3. コミット済み画像の公開 URL を組み立て、到達性を確認する
  const base = rawBase.replace(/\/$/, '');
  const urls = files.map((file) => `${base}/queue/${item.id}/${path.basename(file)}`);
  for (const url of urls) {
    await waitUntilReachable(url);
  }

  // 4. カルーセル投稿。全コンテナが揃ってから publish する
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

  // 5. 履歴に記録（queueId で次回以降スキップされる）
  await appendEntry(HISTORY_FILE, {
    queueId: item.id,
    postedAt: new Date().toISOString(),
    mediaId,
  });
}

main().catch((error) => {
  console.error(`失敗: ${error.message}`);
  process.exitCode = 1;
});
