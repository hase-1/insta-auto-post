// fal.ai の GPT Image 2 で画像を1枚生成し、out/ にローカル保存する使い捨てスクリプト。
// 実行: node --env-file=.env scripts/gen-gpt-image.js
// 認証は環境変数 FAL_KEY（.env に設定済み）を @fal-ai/client が自動で読む。
import { fal } from '@fal-ai/client';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const prompt = `An educational infographic explaining how to use the fal.ai API. Japanese educational infographic style, "Kawaii" vector illustration, flat design with bold black outlines, simple and rounded chibi characters, anthropomorphic objects, clean 2D vector art.
Color palette: Bright pastel colors, soft gradients, cheerful and pop atmosphere.
Decorations: Scattered sparkles, stars, hand-drawn decorative icons, cute visual metaphors, high-quality explanatory thumbnail aesthetic.`;

const result = await fal.subscribe('openai/gpt-image-2', {
  input: {
    prompt,
    image_size: 'square_hd', // 1024x1024
    quality: 'high',
    num_images: 1,
    output_format: 'png',
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === 'IN_PROGRESS') {
      (update.logs ?? []).map((log) => log.message).forEach((m) => console.log(m));
    }
  },
});

const image = result.data.images[0];
console.log('image url:', image.url);

const response = await fetch(image.url);
if (!response.ok) throw new Error(`画像の取得に失敗: HTTP ${response.status}`);
const buffer = Buffer.from(await response.arrayBuffer());

const outDir = path.resolve('out');
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, 'gpt-image-2-sample.png');
await writeFile(outPath, buffer);
console.log('saved:', outPath);
