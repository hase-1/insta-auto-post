import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstagramClient } from '../src/instagram.js';

/** 呼び出し URL を記録しつつ固定レスポンスを返す fetch のモック */
function mockFetch(responses) {
  const calls = [];
  const queue = [...responses];
  const fn = async (url, options) => {
    calls.push({ url: String(url), options });
    const next = queue.shift() ?? { ok: true, body: {} };
    return {
      ok: next.ok,
      status: next.ok ? 200 : 400,
      json: async () => next.body,
      text: async () => JSON.stringify(next.body),
    };
  };
  fn.calls = calls;
  return fn;
}

function client(fetchImpl) {
  return createInstagramClient({ token: 'TOKEN', userId: '123', fetchImpl });
}

test('createCarouselItem は is_carousel_item=true でコンテナIDを返す', async () => {
  const fetchImpl = mockFetch([{ ok: true, body: { id: 'ITEM1' } }]);
  const id = await client(fetchImpl).createCarouselItem('https://example.com/a.jpg');

  assert.equal(id, 'ITEM1');
  const { url } = fetchImpl.calls[0];
  assert.ok(url.includes('/123/media'));
  assert.ok(url.includes('is_carousel_item=true'));
  assert.ok(url.includes(encodeURIComponent('https://example.com/a.jpg')));
  assert.equal(fetchImpl.calls[0].options.method, 'POST');
});

test('createCarousel は children と media_type=CAROUSEL を送る', async () => {
  const fetchImpl = mockFetch([{ ok: true, body: { id: 'PARENT' } }]);
  const id = await client(fetchImpl).createCarousel(['A', 'B'], 'キャプション');

  assert.equal(id, 'PARENT');
  const { url } = fetchImpl.calls[0];
  assert.ok(url.includes('media_type=CAROUSEL'));
  assert.ok(url.includes(`children=${encodeURIComponent('A,B')}`));
  assert.ok(url.includes(encodeURIComponent('キャプション')));
});

test('publish は media_publish に creation_id を送る', async () => {
  const fetchImpl = mockFetch([{ ok: true, body: { id: 'MEDIA' } }]);
  const id = await client(fetchImpl).publish('PARENT');

  assert.equal(id, 'MEDIA');
  const { url } = fetchImpl.calls[0];
  assert.ok(url.includes('/123/media_publish'));
  assert.ok(url.includes('creation_id=PARENT'));
});

test('refreshToken は ig_refresh_token を使い新トークンを返す', async () => {
  const fetchImpl = mockFetch([{ ok: true, body: { access_token: 'NEW', expires_in: 5184000 } }]);
  const result = await client(fetchImpl).refreshToken();

  assert.equal(result.access_token, 'NEW');
  const { url } = fetchImpl.calls[0];
  assert.ok(url.includes('refresh_access_token'));
  assert.ok(url.includes('grant_type=ig_refresh_token'));
});

test('API エラー時は本文を含む例外を投げる', async () => {
  const fetchImpl = mockFetch([{ ok: false, body: { error: { message: 'トークン無効' } } }]);
  await assert.rejects(() => client(fetchImpl).publish('X'), /トークン無効/);
});

test('アクセストークンが例外メッセージに露出しない', async () => {
  const fetchImpl = mockFetch([{ ok: false, body: { error: { message: 'boom' } } }]);
  await assert.rejects(
    () => client(fetchImpl).publish('X'),
    (error) => !error.message.includes('TOKEN'),
  );
});

test('カルーセル上限を超える children で例外を投げる', async () => {
  const many = Array.from({ length: 11 }, (_, i) => `C${i}`);
  await assert.rejects(() => client(mockFetch([])).createCarousel(many, 'c'), /10/);
});
