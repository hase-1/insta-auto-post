import test from 'node:test';
import assert from 'node:assert/strict';
import { waitUntilReachable } from '../src/host.js';

/** 指定回数だけ失敗してから成功する fetch のモック */
function mockFetch(outcomes) {
  const queue = [...outcomes];
  const fn = async () => {
    fn.calls += 1;
    const next = queue.shift();
    if (next === 'throw') throw new Error('ECONNRESET');
    return { ok: next === 'ok', status: next === 'ok' ? 200 : 404 };
  };
  fn.calls = 0;
  return fn;
}

const fast = { delayMs: 0, attempts: 4 };

test('最初から取得できれば1回で返る', async () => {
  const fetchImpl = mockFetch(['ok']);
  await waitUntilReachable('https://example.com/a.jpg', { fetchImpl, ...fast });
  assert.equal(fetchImpl.calls, 1);
});

test('404 が続いても反映後に成功すれば返る', async () => {
  const fetchImpl = mockFetch(['404', '404', 'ok']);
  await waitUntilReachable('https://example.com/a.jpg', { fetchImpl, ...fast });
  assert.equal(fetchImpl.calls, 3);
});

test('ネットワーク例外も待って再試行する', async () => {
  const fetchImpl = mockFetch(['throw', 'ok']);
  await waitUntilReachable('https://example.com/a.jpg', { fetchImpl, ...fast });
  assert.equal(fetchImpl.calls, 2);
});

test('試行回数を使い切ったら URL を含む例外を投げる', async () => {
  const fetchImpl = mockFetch(['404', '404', '404', '404']);
  await assert.rejects(
    () => waitUntilReachable('https://example.com/a.jpg', { fetchImpl, ...fast }),
    /example\.com\/a\.jpg/,
  );
  assert.equal(fetchImpl.calls, 4);
});
