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
