import test from 'node:test';
import assert from 'node:assert/strict';
import { pageHtml, escapeHtml } from '../src/slide-html.js';
import { IMAGE } from '../src/config.js';

test('escapeHtml は HTML 特殊文字を無害化する', () => {
  assert.equal(escapeHtml('<b>&"x"</b>'), '&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;');
});

test('pageHtml は完全な HTML 文書を返す', () => {
  const html = pageHtml({ type: 'cover', tag: 'タグ', title: 'テーマ', countLabel: '5選' });
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('</html>'));
});

test('cover スライドはタグ・タイトル・件数を含む', () => {
  const html = pageHtml({ type: 'cover', tag: 'IT初心者さん向け', title: 'テーマX', countLabel: '5選' });
  assert.ok(html.includes('IT初心者さん向け'));
  assert.ok(html.includes('テーマX'));
  assert.ok(html.includes('5選'));
  assert.ok(html.includes('Swipe next'));
});

test('item スライドは通し番号・タイトル・本文を含む', () => {
  const html = pageHtml({ type: 'item', index: 2, total: 5, title: 'タイトルY', body: '本文Z' });
  assert.ok(html.includes('タイトルY'));
  assert.ok(html.includes('本文Z'));
  assert.ok(html.includes('02'));
});

test('cta スライドはハンドル名を含む', () => {
  const html = pageHtml({ type: 'cta', title: 'T', body: 'B', handle: '@handle' });
  assert.ok(html.includes('@handle'));
});

test('本文中の改行は <br> に変換される', () => {
  const html = pageHtml({ type: 'item', index: 1, total: 5, title: 'T', body: 'あ\nい' });
  assert.ok(html.includes('あ<br>い'));
});

test('タイトルの山括弧はエスケープされる', () => {
  const html = pageHtml({ type: 'item', index: 1, total: 5, title: '<script>', body: 'B' });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('キャンバスサイズが設定値と一致する', () => {
  const html = pageHtml({ type: 'cover', tag: 'a', title: 'b', countLabel: 'c' });
  assert.ok(html.includes(`${IMAGE.size}px`));
});

test('未知のスライド種別は例外を投げる', () => {
  assert.throws(() => pageHtml({ type: 'unknown' }), /unknown/);
});
