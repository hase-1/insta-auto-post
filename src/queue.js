import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * キューディレクトリ配下の投稿フォルダを名前順に列挙する。
 * 各フォルダ名がそのままキューID（投稿済み判定に使う）。
 */
export async function listQueue(queueDir) {
  let entries;
  try {
    entries = await readdir(queueDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => ({ id: e.name, dir: path.join(queueDir, e.name) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * まだ投稿していない先頭のキュー項目を返す。全て投稿済みなら null。
 * 投稿済みかどうかは history の queueId で判定する。
 */
export function nextUnposted(queueItems, history) {
  const posted = new Set(history.map((entry) => entry.queueId).filter(Boolean));
  return queueItems.find((item) => !posted.has(item.id)) ?? null;
}

/**
 * キュー項目から画像ファイルパス（名前順）とキャプションを読み込む。
 * 画像は NN.jpg 形式、キャプションは caption.txt を前提とする。
 */
export async function loadQueueItem(item) {
  const files = (await readdir(item.dir))
    .filter((name) => name.endsWith('.jpg'))
    .sort()
    .map((name) => path.join(item.dir, name));
  if (!files.length) {
    throw new Error(`キュー項目に画像がない: ${item.id}`);
  }
  const caption = await readFile(path.join(item.dir, 'caption.txt'), 'utf8');
  return { files, caption };
}
