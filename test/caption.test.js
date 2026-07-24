import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCaption, bodyBudget, assertCaptionValid } from '../src/caption.js';
import { IG, CAPTION } from '../src/config.js';

test('buildCaption はテーマを ／＼ で囲んで含める', () => {
  const caption = buildCaption({ theme: 'テストテーマ', body: '本文' });
  assert.ok(caption.includes('／\nテストテーマ\n＼'));
});

test('buildCaption は本文を含める', () => {
  const caption = buildCaption({ theme: 'T', body: 'これが本文です' });
  assert.ok(caption.includes('これが本文です'));
});

test('buildCaption は固定ブロックをすべて含める', () => {
  const caption = buildCaption({ theme: 'T', body: 'B' });
  for (const key of ['header', 'cta', 'review', 'service', 'profile', 'contents', 'lineOffer']) {
    assert.ok(caption.includes(CAPTION[key]), `${key} が欠落している`);
  }
});

test('buildCaption はハッシュタグを1行ずつ並べる', () => {
  const caption = buildCaption({ theme: 'T', body: 'B', hashtags: ['#a', '#b'] });
  assert.ok(caption.endsWith('#a\n#b'));
});

test('bodyBudget は 2200 文字に収まる正の予算を返す', () => {
  const budget = bodyBudget('テーマ例');
  assert.ok(budget > 0, `予算が正でない: ${budget}`);
  const caption = buildCaption({ theme: 'テーマ例', body: 'あ'.repeat(budget) });
  assert.ok(caption.length <= IG.captionMaxLength, `${caption.length} 文字で上限超過`);
});

test('assertCaptionValid は上限超過で例外を投げる', () => {
  assert.throws(() => assertCaptionValid('あ'.repeat(IG.captionMaxLength + 1)), /2200/);
});

test('assertCaptionValid はハッシュタグ31個で例外を投げる', () => {
  const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join('\n');
  assert.throws(() => assertCaptionValid(tags), /ハッシュタグ/);
});

test('assertCaptionValid は正常なキャプションを通す', () => {
  const caption = buildCaption({ theme: 'T', body: '短い本文' });
  assert.doesNotThrow(() => assertCaptionValid(caption));
});
