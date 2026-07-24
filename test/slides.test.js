import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSlides } from '../src/slides.js';
import { BRAND } from '../src/config.js';

const items = [
  { title: '項目1', body: '説明1' },
  { title: '項目2', body: '説明2' },
  { title: '項目3', body: '説明3' },
  { title: '項目4', body: '説明4' },
  { title: '項目5', body: '説明5' },
];

test('buildSlides は 表紙 + 項目数 + CTA 枚のスライドを返す', () => {
  const slides = buildSlides({ theme: 'テーマ', items });
  assert.equal(slides.length, items.length + 2);
});

test('先頭は cover スライドでテーマとタグを持つ', () => {
  const [cover] = buildSlides({ theme: 'テーマ', items });
  assert.equal(cover.type, 'cover');
  assert.equal(cover.title, 'テーマ');
  assert.equal(cover.tag, BRAND.tag);
  assert.equal(cover.countLabel, '5選');
});

test('中間は item スライドで 1 始まりの通し番号を持つ', () => {
  const slides = buildSlides({ theme: 'テーマ', items });
  const itemSlides = slides.filter((s) => s.type === 'item');
  assert.equal(itemSlides.length, 5);
  assert.deepEqual(itemSlides.map((s) => s.index), [1, 2, 3, 4, 5]);
  assert.equal(itemSlides[0].title, '項目1');
  assert.equal(itemSlides[4].body, '説明5');
});

test('末尾は cta スライド', () => {
  const slides = buildSlides({ theme: 'テーマ', items });
  assert.equal(slides.at(-1).type, 'cta');
});

test('項目が空なら例外を投げる', () => {
  assert.throws(() => buildSlides({ theme: 'テーマ', items: [] }), /項目/);
});

test('カルーセル上限 10 枚を超えるなら例外を投げる', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ title: `t${i}`, body: `b${i}` }));
  assert.throws(() => buildSlides({ theme: 'テーマ', items: many }), /10/);
});
