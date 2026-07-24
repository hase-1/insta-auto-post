import { execFile } from 'node:child_process';
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

// push してから raw.githubusercontent.com に反映されるまでの待ち設定
const REACH_ATTEMPTS = 10;
const REACH_DELAY_MS = 3000;

/**
 * 公開URLから実際に画像を取得できるようになるまで待つ。
 *
 * push 直後は CDN に反映されておらず 404 が返ることがある。
 * その状態で Instagram に URL を渡すとコンテナ作成が失敗するため、
 * 投稿前にこちらで到達性を確かめる。
 */
export async function waitUntilReachable(url, { fetchImpl = globalThis.fetch, delayMs = REACH_DELAY_MS, attempts = REACH_ATTEMPTS } = {}) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const response = await fetchImpl(url, { method: 'HEAD' });
      if (response.ok) return;
    } catch {
      // ネットワーク側の一時的な失敗も待って再試行する
    }
    if (i < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`画像が公開URLから取得できない: ${url}`);
}

/**
 * 変更がある場合だけコミットする。
 * 同じ日に再実行すると差分が無く、git commit が非ゼロ終了して
 * 実行全体を落としてしまうため、事前に差分の有無を確かめる。
 * @returns {Promise<boolean>} コミットしたかどうか
 */
async function commitIfChanged(repoDir, pathspec, message) {
  await run('git', ['add', pathspec], { cwd: repoDir });
  try {
    // 差分が無いときだけ終了コード 0 になる
    await run('git', ['diff', '--staged', '--quiet'], { cwd: repoDir });
    return false;
  } catch {
    await run('git', ['commit', '-m', message], { cwd: repoDir });
    return true;
  }
}

/**
 * 生成画像をリポジトリへ commit & push し、公開 URL を返す。
 * Instagram Graph API は公開 HTTP(S) URL の画像しか受け付けないため必要。
 *
 * 戻り値のインターフェースを (files) => urls に保っているので、
 * 将来 Cloudflare R2 や S3 へ差し替える際も他モジュールの変更は不要。
 */
export async function publishImages({ files, repoDir, rawBase, slug, branch = 'main', fetchImpl }) {
  if (!rawBase) throw new Error('GITHUB_RAW_BASE が未設定');

  const destDir = path.join(repoDir, 'public', slug);
  await mkdir(destDir, { recursive: true });

  const urls = [];
  for (const file of files) {
    const name = path.basename(file);
    await cp(file, path.join(destDir, name));
    urls.push(`${rawBase.replace(/\/$/, '')}/public/${slug}/${name}`);
  }

  const pathspec = path.posix.join('public', slug);
  const committed = await commitIfChanged(repoDir, pathspec, `chore: ${slug} の投稿画像を追加`);
  if (committed) {
    await run('git', ['push', 'origin', branch], { cwd: repoDir });
  }

  // 反映を待ってから URL を返す。ここで落ちれば投稿前に止まるので、
  // 画像が欠けたカルーセルが公開されることはない
  for (const url of urls) {
    await waitUntilReachable(url, { fetchImpl });
  }

  return urls;
}
