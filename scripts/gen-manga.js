// Claude / Codex / ChatGPT / Gemini の違いを6コマ漫画にする使い捨てスクリプト。
// 実行: node --env-file=.env scripts/gen-manga.js
import { fal } from '@fal-ai/client';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const prompt = `A cute, easy-to-understand Japanese 6-panel manga (6コマ漫画) laid out as a clean grid of 3 rows x 2 columns, panels clearly numbered 1 to 6 with borders. Each panel has a small chibi robot mascot and a short Japanese speech bubble. All text in Japanese, big and legible. Comparing four AI assistants.

Panel 1 (title): タイトル「4つのAIの違い」。4体のかわいいAIロボットが並んで「よろしく！」
Panel 2: ChatGPT のロボット。セリフ「なんでも相談できる人気者。会話と文章づくりが得意！」
Panel 3: Claude のロボット。セリフ「じっくり考えるのが得意。長い文章やコーディングが丁寧！」
Panel 4: Codex のロボット（工具やコードを持つ職人風）。セリフ「コーディング専門の職人。プログラム作りに特化！」
Panel 5: Gemini のロボット（虫めがねと検索バー）。セリフ「Googleと仲良し。検索やメール・資料との連携が得意！」
Panel 6 (まとめ): 4体が並んで「用途で使い分けよう！」

Style: Japanese educational "Kawaii" vector illustration, flat design with bold black outlines, rounded chibi characters, clean 2D vector art. Bright pastel colors, soft gradients, cheerful and pop. Scattered sparkles and stars. High-quality explanatory thumbnail aesthetic. Clear panel gutters so the 6 panels are easy to tell apart.`;

const result = await fal.subscribe('openai/gpt-image-2', {
  input: { prompt, image_size: 'portrait_4_3', quality: 'high', num_images: 1, output_format: 'png' },
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
const outPath = path.join(outDir, 'manga-ai-hikaku.png');
await writeFile(outPath, Buffer.from(await res.arrayBuffer()));
console.log('saved:', outPath);
