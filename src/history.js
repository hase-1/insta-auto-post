import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

/** 履歴を読む。ファイルが無ければ空配列を返す（初回実行のため） */
export async function loadHistory(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

/** 履歴を1件追記する */
export async function appendEntry(file, entry) {
  const history = await loadHistory(file);
  history.push(entry);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
  return history;
}

/** 直近のテーマを新しい順に返す。生成時の重複回避に使う */
export function recentThemes(history, count = 20) {
  return history.slice(-count).reverse().map((entry) => entry.theme);
}

/** 同じテーマが既に投稿済みかを判定する */
export function isDuplicate(history, theme) {
  const normalized = theme.trim();
  return history.some((entry) => entry.theme.trim() === normalized);
}
