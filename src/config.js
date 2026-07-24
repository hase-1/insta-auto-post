// Instagram Graph API（Instagram Login 方式）の定数
export const IG = {
  host: 'https://graph.instagram.com',
  version: 'v25.0',
  captionMaxLength: 2200,
  maxHashtags: 30,
  maxCarouselItems: 10,
};

// 画像の出力仕様。Instagram は JPEG のみ受け付ける
export const IMAGE = {
  size: 1080,
  format: 'jpeg',
  quality: 92,
};

// 既存投稿から採取したブランド定義
export const BRAND = {
  handle: 'hasesan_kigyou_support',
  tag: 'IT初心者さん向け',
  bgFrom: '#FFC24D',
  bgTo: '#F26A21',
  tagBg: '#E8452B',
  accent: '#F26A21',
  cardBg: '#FFFFFF',
  ink: '#1F1F1F',
};

// カルーセルの項目数。表紙 + ITEM_COUNT + CTA = 全スライド数
export const ITEM_COUNT = 5;

// テーマの想定最大長。本文の文字数予算はテーマ生成前に決める必要があるため、
// この長さを先に確保しておく（実際のテーマはこれより短い前提）
export const MAX_THEME_LENGTH = 40;

// 空配列なら AI が自由にテーマを決める。
// 内容を絞りたくなったらここに候補を入れるとその中から選ばせる
export const THEME_HINTS = [];

// 既存投稿のキャプションから採取した固定ブロック
export const CAPTION = {
  header: `@hasesan_kigyou_support ←他の投稿はこちら\n※今日のテーマ`,

  divider: '𓇠𓇠𓇠𓇠𓇠𓇠𓇠𓇠𓇠𓇠',

  cta: `コメントはお気軽に！
お困りごと、お悩みごと、何から始めていいか分からない方はDMください。

この投稿が役に立った！という方は
「いいね」「コメント」「フォロー」
してくださると感激です
↓↓↓
@hasesan_kigyou_support`,

  review: `■レビュー

「まったくの初心者から、オンライン講師デビューできた！」
「どこよりもやさしく教えてくれて、集客できるようになった」

など、嬉しいお声をいただいております。`,

  service: `■サービス

「オンライン起業ITスクール」

❍興味があるけれど何をしたらいいか分からない方
❍起業塾に入ったけれどついていけなかった方
❍基本操作からしっかり身に付けたい方

起業塾よりはるかに手軽な月額制で
各種SNS、ZOOM、決済ツール、集客導線などを
学べるオンラインスクール。

ITが苦手な方、シニアの方にも
1からやさしく教えています。`,

  profile: `■プロフィール

❍ 東京在住
❍ 3年間でIT苦手な女性起業家600名以上を指導
❍ 日本全国だけでなく、海外在住の日本人にも対応
❍ 50代会社員女性を副業や起業で人生を豊かにする
❍ ストアカプラチナバッチ講師・満足度★5`,

  contents: `■Instagramの発信内容

❍ IT初心者が1からオンラインで起業できるような内容
❍ 集客導線の作り方、最短導線の最新情報
❍起業で効果的なパソコンや周辺機器のアドバイス`,

  lineOffer: `／
今だけLINE登録で
起業に役立つ
3大特典プレゼント
＼

プレゼント受け取りはこちら
↓↓↓
@hasesan_kigyou_support`,
};

// 既存投稿から採取したハッシュタグ
export const HASHTAGS = [
  '#起業女子',
  '#起業初心者',
  '#起業女性',
  '#主婦起業',
  '#起業初心者サポート',
  '#起業家女性応援',
  '#オンライン集客法',
  '#在宅ワークママ',
  '#副業始めました',
  '#起業サポート',
  '#起業準備中',
  '#起業ママと繋がりたい',
  '#起業したいママ',
  '#起業家女性',
  '#女性起業家応援',
];

// AI が生成してはいけない表現。themes.js のプロンプトで使う
export const FORBIDDEN = [
  '「必ず稼げる」「確実に」など効果を保証する断定表現',
  '具体的な金額での収益保証（例:「月100万円が確実に稼げます」）',
  '医療・健康・投資に関する助言',
  '他者・他サービスの誹謗中傷',
  '出典のない統計や数値',
];
