// Canonical emoji normalization and mapping utility for ChatRooms
export const EMOJI_MAP = {
  // Fire / flame
  '[fire]': '🔥',
  'fire': '🔥',
  'Flame': '🔥',
  'flame': '🔥',
  '🔥': '🔥',

  // Heart / love
  '[heart]': '❤️',
  'heart': '❤️',
  'Heart': '❤️',
  'love': '❤️',
  '❤️': '❤️',

  // Thumbs up / like
  '+1': '👍',
  '[like]': '👍',
  'like': '👍',
  'Like': '👍',
  '[thumbsup]': '👍',
  'thumbsup': '👍',
  '👍': '👍',

  // Thumbs down
  '-1': '👎',
  '[dislike]': '👎',
  'dislike': '👎',
  '👎': '👎',

  // Star / favorite
  '[star]': '⭐',
  'star': '⭐',
  'Star': '⭐',
  '⭐': '⭐',

  // Handshake / agree
  '[agree]': '🤝',
  'agree': '🤝',
  'Agree': '🤝',
  'handshake': '🤝',
  '🤝': '🤝',

  // Celebrate / party
  '[celebrate]': '🎉',
  'celebrate': '🎉',
  'Celebrate': '🎉',
  'party': '🎉',
  'tada': '🎉',
  '🎉': '🎉',

  // Laugh
  '[laugh]': '😂',
  'laugh': '😂',
  'Laugh': '😂',
  'joy': '😂',
  '😂': '😂',

  // Smile
  '[smile]': '😊',
  'smile': '😊',
  'Smile': '😊',
  'happy': '😊',
  '😊': '😊',

  // Rocket / Fast / Launch
  '[rocket]': '🚀',
  'rocket': '🚀',
  'Launch': '🚀',
  'launch': '🚀',
  'Fast': '⚡',
  'fast': '⚡',
  '⚡': '⚡',
  '🚀': '🚀',

  // Check / Noted / Done
  '[check]': '✅',
  'Check': '✅',
  'check': '✅',
  'Noted': '📝',
  'noted': '📝',
  '✅': '✅',

  // 100
  '[100]': '💯',
  '100': '💯',
  '💯': '💯',

  // Clap
  '[clap]': '👏',
  'clap': '👏',
  '👏': '👏',

  // Eyes / Review
  'Review': '👀',
  'review': '👀',
  'eyes': '👀',
  '👀': '👀',

  // Pin
  'Pin': '📌',
  'pin': '📌',
  '📌': '📌',

  // Idea / Insight
  'Insight': '💡',
  'insight': '💡',
  'idea': '💡',
  '💡': '💡',

  // Priority
  'Priority': '🚨',
  'priority': '🚨',
  '🚨': '🚨',

  // Support / Pray
  'Support': '🙌',
  'support': '🙌',
  'pray': '🙏',
  'thanks': '🙏',
  '🙏': '🙏',
  '🙌': '🙌',
};

/**
 * Converts any emoji tag or textual alias (e.g. "[fire]", "Flame", "+1")
 * into its proper Unicode emoji glyph.
 */
export const normalizeEmoji = (emoji) => {
  if (!emoji) return '👍';
  const clean = String(emoji).trim();
  if (EMOJI_MAP[clean]) return EMOJI_MAP[clean];
  const lower = clean.toLowerCase();
  if (EMOJI_MAP[lower]) return EMOJI_MAP[lower];
  const unbracketed = lower.replace(/^\[|\]$/g, '');
  if (EMOJI_MAP[unbracketed]) return EMOJI_MAP[unbracketed];
  return clean;
};

/**
 * Replaces inline token tags like [fire] or [heart] with actual emojis in text
 */
export const renderContentWithEmojis = (content) => {
  if (!content || typeof content !== 'string') return content;
  return content.replace(/\[([a-zA-Z0-9_+]+)\]/g, (match, tag) => {
    const norm = normalizeEmoji(tag);
    return norm !== tag ? norm : match;
  });
};
