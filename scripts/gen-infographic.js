// テーマ+要点3つを、fal.ai の GPT Image 2 で1枚の図解画像にするワークフロー用スクリプト。
// 実行: node --env-file=.env scripts/gen-infographic.js
// 別テーマで使うときは、下の theme / points / outName の3つを書き換えるだけ。
import { fal } from '@fal-ai/client';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// ===== ここだけ書き換えれば別テーマの図解が作れる =====
const theme = 'ChatGPTを起業に活かす簡単な使い方';
const points = [
  '文章づくりを任せる：メール・SNS投稿・企画書の下書きを一瞬で',
  'リサーチを時短：調べ物を要約・比較して整理してもらう',
  'アイデア出しの相棒：テーマ案やキャッチコピーを一緒に考える',
];
const outName = 'workflow-chatgpt.png';
// =====================================================

const style = `Japanese educational infographic style, "Kawaii" vector illustration, flat design with bold black outlines, simple and rounded chibi characters, anthropomorphic objects, clean 2D vector art.
Color palette: Bright pastel colors, soft gradients, cheerful and pop atmosphere.
Decorations: Scattered sparkles, stars, hand-drawn decorative icons, cute visual metaphors, high-quality explanatory thumbnail aesthetic.`;

const prompt = `A single square educational infographic thumbnail. All text must be in Japanese and legible.
Big title at the top: 「${theme}」
Then exactly three points, each inside its own cute rounded card with a large number badge (1, 2, 3) and a matching icon:
1. ${points[0]}
2. ${points[1]}
3. ${points[2]}
Layout: title on top, three numbered cards clearly separated, generous spacing, clean and easy to read.
${style}`;

const result = await fal.subscribe('openai/gpt-image-2', {
  input: { prompt, image_size: 'square_hd', quality: 'high', num_images: 1, output_format: 'png' },
  logs: true,
  onQueueUpdate: (u) => {
    if (u.status === 'IN_PROGRESS') (u.logs ?? []).map((l) => l.message).forEach((m) => console.log(m));
  },
});

const image = result.data.images[0];
console.log('image url:', image.url);

const res = await fetch(image.url);
if (!res.ok) throw new Error(`画像の取得に失敗: HTTP ${res.status}`);

const outDir = path.resolve('out');
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, outName);
await writeFile(outPath, Buffer.from(await res.arrayBuffer()));
console.log('saved:', outPath);
