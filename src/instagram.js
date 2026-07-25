import { IG } from './config.js';

/**
 * Instagram Graph API（Instagram Login 方式）のクライアント。
 * API 呼び出しをこのファイルに閉じ込め、仕様変更の影響を局所化する。
 */
export function createInstagramClient({
  token,
  userId,
  fetchImpl = globalThis.fetch,
  host = IG.host,
  version = IG.version,
}) {
  if (!token) throw new Error('IG_ACCESS_TOKEN が未設定');
  if (!userId) throw new Error('IG_USER_ID が未設定');

  async function call(pathname, params, { versioned = true, method = 'POST' } = {}) {
    const base = versioned ? `${host}/${version}${pathname}` : `${host}${pathname}`;
    const url = new URL(base);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set('access_token', token);

    const response = await fetchImpl(url, { method });
    const payload = await response.json();

    if (!response.ok) {
      // トークンを含む URL は決してログへ出さない
      const detail = payload?.error?.message ?? JSON.stringify(payload);
      throw new Error(`Instagram API エラー (${response.status}): ${detail}`);
    }
    return payload;
  }

  /** コンテナの処理状況を返す（IN_PROGRESS / FINISHED / ERROR / EXPIRED / PUBLISHED） */
  async function getStatus(containerId) {
    const { status_code: statusCode } = await call(
      `/${containerId}`,
      { fields: 'status_code' },
      { method: 'GET' },
    );
    return statusCode;
  }

  /**
   * コンテナが公開可能（FINISHED）になるまで待つ。
   * カルーセル親コンテナは作成直後 IN_PROGRESS で、その状態で publish すると
   * 「Media ID is not available」で失敗するため、FINISHED を待ってから公開する。
   */
  async function waitUntilReady(containerId, { attempts = 30, delayMs = 3000 } = {}) {
    for (let i = 1; i <= attempts; i += 1) {
      const status = await getStatus(containerId);
      if (status === 'FINISHED') return;
      if (status === 'ERROR' || status === 'EXPIRED') {
        throw new Error(`コンテナが公開できない状態: ${status} (${containerId})`);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error(`コンテナが時間内に FINISHED にならなかった: ${containerId}`);
  }

  return {
    /** カルーセルの1枚分のコンテナを作る */
    async createCarouselItem(imageUrl) {
      const { id } = await call(`/${userId}/media`, {
        image_url: imageUrl,
        is_carousel_item: 'true',
      });
      return id;
    },

    /** 子コンテナをまとめる親コンテナを作る */
    async createCarousel(childIds, caption) {
      if (childIds.length > IG.maxCarouselItems) {
        throw new Error(
          `カルーセルの枚数が ${childIds.length} 枚で上限 ${IG.maxCarouselItems} 枚を超過`,
        );
      }
      const { id } = await call(`/${userId}/media`, {
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption,
      });
      return id;
    },

    getStatus,
    waitUntilReady,

    /** 親コンテナを公開する。ここまで来て初めて投稿が世に出る */
    async publish(creationId) {
      // 作成直後は処理中のことがあるため、FINISHED を待ってから公開する
      await waitUntilReady(creationId);
      const { id } = await call(`/${userId}/media_publish`, { creation_id: creationId });
      return id;
    },

    /** 長期トークンを更新する。60日で失効するため定期実行が必須 */
    async refreshToken() {
      return call(
        '/refresh_access_token',
        { grant_type: 'ig_refresh_token' },
        { versioned: false, method: 'GET' },
      );
    },
  };
}
