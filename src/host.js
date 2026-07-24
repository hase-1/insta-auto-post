import { execFile } from 'node:child_process';
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * 生成画像をリポジトリへ commit & push し、公開 URL を返す。
 * Instagram Graph API は公開 HTTP(S) URL の画像しか受け付けないため必要。
 *
 * 戻り値のインターフェースを (files) => urls に保っているので、
 * 将来 Cloudflare R2 や S3 へ差し替える際も他モジュールの変更は不要。
 */
export async function publishImages({ files, repoDir, rawBase, slug, branch = 'main' }) {
  if (!rawBase) throw new Error('GITHUB_RAW_BASE が未設定');

  const destDir = path.join(repoDir, 'public', slug);
  await mkdir(destDir, { recursive: true });

  const urls = [];
  for (const file of files) {
    const name = path.basename(file);
    await cp(file, path.join(destDir, name));
    urls.push(`${rawBase.replace(/\/$/, '')}/public/${slug}/${name}`);
  }

  await run('git', ['add', path.posix.join('public', slug)], { cwd: repoDir });
  await run('git', ['commit', '-m', `chore: ${slug} の投稿画像を追加`], { cwd: repoDir });
  await run('git', ['push', 'origin', branch], { cwd: repoDir });

  return urls;
}
