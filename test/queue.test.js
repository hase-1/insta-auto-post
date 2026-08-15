import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { listQueue, nextUnposted, loadQueueItem } from '../src/queue.js';

async function makeQueue(items) {
  const root = await mkdtemp(path.join(tmpdir(), 'queue-'));
  for (const [name, opts = {}] of items) {
    const dir = path.join(root, name);
    await mkdir(dir, { recursive: true });
    for (let i = 1; i <= (opts.images ?? 0); i += 1) {
      await writeFile(path.join(dir, `${String(i).padStart(2, '0')}.jpg`), 'x');
    }
    if (opts.caption) await writeFile(path.join(dir, 'caption.txt'), opts.caption);
  }
  return root;
}

test('listQueue は存在しないディレクトリで空配列を返す', async () => {
  assert.deepEqual(await listQueue(path.join(tmpdir(), 'no-such-dir-xyz')), []);
});

test('listQueue はフォルダを名前順に返す', async () => {
  const root = await makeQueue([['003-c'], ['001-a'], ['002-b']]);
  const items = await listQueue(root);
  assert.deepEqual(items.map((i) => i.id), ['001-a', '002-b', '003-c']);
});

test('nextUnposted は投稿済みを飛ばして先頭の未投稿を返す', () => {
  const queue = [{ id: '001' }, { id: '002' }, { id: '003' }];
  const history = [{ queueId: '001' }];
  assert.equal(nextUnposted(queue, history).id, '002');
});

test('nextUnposted は全て投稿済みなら null を返す', () => {
  const queue = [{ id: '001' }];
  const history = [{ queueId: '001' }];
  assert.equal(nextUnposted(queue, history), null);
});

test('nextUnposted は queueId を持たない古い履歴を無視する', () => {
  const queue = [{ id: '001' }];
  const history = [{ theme: '昔の投稿' }]; // queueId なし
  assert.equal(nextUnposted(queue, history).id, '001');
});

test('loadQueueItem は画像を名前順に、キャプションを読み込む', async () => {
  const root = await makeQueue([['001', { images: 3, caption: 'テスト本文' }]]);
  const [item] = await listQueue(root);
  const { files, caption } = await loadQueueItem(item);
  assert.equal(files.length, 3);
  assert.ok(files[0].endsWith('01.jpg'));
  assert.ok(files[2].endsWith('03.jpg'));
  assert.equal(caption, 'テスト本文');
});

test('loadQueueItem は画像が無いと例外を投げる', async () => {
  const root = await makeQueue([['001', { caption: 'x' }]]);
  const [item] = await listQueue(root);
  await assert.rejects(() => loadQueueItem(item), /画像がない/);
});
