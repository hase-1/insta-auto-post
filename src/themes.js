import Anthropic from '@anthropic-ai/sdk';
import { ITEM_COUNT, FORBIDDEN, THEME_HINTS, MAX_THEME_LENGTH } from './config.js';

const MODEL = 'claude-sonnet-5';

// tool 定義でスキーマを強制する。自由記述の JSON より確実にパースできる
const POST_TOOL = {
  name: 'submit_post',
  description: 'Instagram 投稿の内容を提出する',
  input_schema: {
    type: 'object',
    properties: {
      theme: {
        type: 'string',
        description: `カルーセル表紙の見出し。20〜30文字。体言止め。${MAX_THEME_LENGTH}文字を超えないこと。改行(\\n)で2行に分けること`,
      },
      emphasis: {
        type: 'array',
        maxItems: 2,
        items: { type: 'string' },
        description: 'theme の中でブランド色に着色する語句。theme に完全一致で含まれる部分文字列であること',
      },
      items: {
        type: 'array',
        minItems: ITEM_COUNT,
        maxItems: ITEM_COUNT,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '項目の見出し。15〜25文字。改行(\\n)で2行に分けること' },
            body: { type: 'string', description: '項目の説明。40〜70文字' },
          },
          required: ['title', 'body'],
        },
      },
      body: {
        type: 'string',
        description: 'キャプション本文。話し言葉で親しみやすく',
      },
    },
    required: ['theme', 'emphasis', 'items', 'body'],
  },
};

function buildPrompt({ recent, budget }) {
  return `あなたは「はせさん」というオンライン起業サポートの発信者です。
IT が苦手な初心者、特に 50 代の会社員女性に向けて Instagram で発信しています。

# 依頼
Instagram のカルーセル投稿を1本作ってください。

# 発信者の背景
- 3年間で IT が苦手な女性起業家 600 名以上を指導
- ストアカのプラチナバッジ講師
- 月額制のオンライン起業 IT スクールを運営

# 文体
- 語りかけるような、やさしい話し言葉
- 専門用語を使うときは必ず噛み砕いて説明する
- 押しつけがましくない

# 制約
- theme は表紙の見出しになるため、具体的で興味を引くもの。${MAX_THEME_LENGTH} 文字以内
- items はちょうど ${ITEM_COUNT} 個
- body は ${budget} 文字以内。**必ず守ること**
- 次の表現は禁止:
${FORBIDDEN.map((f) => `  - ${f}`).join('\n')}
${THEME_HINTS.length ? `\n# テーマは次の候補から選ぶこと\n${THEME_HINTS.map((t) => `- ${t}`).join('\n')}` : ''}

# 直近で投稿済みのテーマ（重複させないこと）
${recent.length ? recent.map((t) => `- ${t}`).join('\n') : '（まだ投稿がありません）'}

submit_post ツールで提出してください。`;
}

/**
 * テーマ・5項目・キャプション本文を生成する。
 * @param {object} options
 * @param {string[]} options.recent 直近の投稿テーマ（重複回避用）
 * @param {number} options.budget キャプション本文に使える最大文字数
 * @param {Anthropic} [options.client] テスト時に差し替える
 */
export async function generateContent({ recent, budget, client }) {
  const anthropic = client ?? new Anthropic();

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [POST_TOOL],
    tool_choice: { type: 'tool', name: 'submit_post' },
    messages: [{ role: 'user', content: buildPrompt({ recent, budget }) }],
  });

  const toolUse = message.content.find((block) => block.type === 'tool_use');
  if (!toolUse) {
    throw new Error('Claude が submit_post ツールを呼ばなかった');
  }

  const result = toolUse.input;
  if (result.items?.length !== ITEM_COUNT) {
    throw new Error(`項目数が ${result.items?.length} 個。${ITEM_COUNT} 個であるべき`);
  }
  if (result.body.length > budget) {
    throw new Error(`本文が ${result.body.length} 文字で予算 ${budget} 文字を超過`);
  }
  if (result.theme.length > MAX_THEME_LENGTH) {
    throw new Error(`テーマが ${result.theme.length} 文字で上限 ${MAX_THEME_LENGTH} 文字を超過`);
  }

  // emphasis は theme の一部を着色するためだけに使う演出用の情報。
  // theme に実際に含まれない語句が返ってきても、強調が効かないだけで
  // 投稿自体は成立するため、例外は投げずに黙って除外する
  result.emphasis = (result.emphasis ?? []).filter((word) => result.theme.includes(word));

  return result;
}
