import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadHistory } from './history.js';
import { listQueue, nextUnposted } from './queue.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HISTORY_FILE = path.join(ROOT, 'data', 'history.json');
const QUEUE_DIR = path.join(ROOT, 'queue');

// 残りがこの本数以下になったら警告する（週3回投稿で約1週間分の猶予）
const WARN_THRESHOLD = 3;

async function main() {
  const history = await loadHistory(HISTORY_FILE);
  const queue = await listQueue(QUEUE_DIR);
  const posted = new Set(history.map((e) => e.queueId).filter(Boolean));
  const remaining = queue.filter((item) => !posted.has(item.id));

  console.log(`キュー総数: ${queue.length} / 未投稿: ${remaining.length}`);
  console.log(`未投稿の内訳: ${remaining.map((i) => i.id).join(', ') || '(なし)'}`);

  if (remaining.length <= WARN_THRESHOLD) {
    // 失敗させることで GitHub からオーナー宛に通知メールが届く。
    // これを合図に Claude に「在庫補充して」と頼めばよい
    console.error(
      `\n⚠️ 在庫が残り ${remaining.length} 本です（しきい値 ${WARN_THRESHOLD}）。` +
        `\nそろそろ投稿の補充が必要です。Claude に「インスタの在庫を補充して」と頼んでください。`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`残り ${remaining.length} 本。まだ余裕があります。`);
}

main().catch((error) => {
  console.error(`在庫チェックに失敗: ${error.message}`);
  process.exitCode = 1;
});
