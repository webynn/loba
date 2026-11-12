import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const hashToken = token => createHash('sha256').update(token).digest('hex');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [salt, hex] = (stored || '00000000000000000000000000000000:' + '00'.repeat(64)).split(':');
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return key.length === expected.length && timingSafeEqual(key, expected);
}
export function fail(status, message) { return Object.assign(new Error(message), { status }); }
function string(value, name, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw fail(400, `${name} is required and must be at most ${max} characters.`);
  return value.trim();
}
export function validateLesson(input) {
  if (!input || typeof input !== 'object' || !['ln', 'sw'].includes(input.language)) throw fail(400, 'Select Lingala or Swahili.');
  if (!Number.isInteger(input.position) || input.position < 1 || input.position > 999) throw fail(400, 'Position must be between 1 and 999.');
  if (!Array.isArray(input.words) || input.words.length > 100) throw fail(400, 'Use at most 100 vocabulary entries.');
  if (!Array.isArray(input.sentences) || input.sentences.length > 100) throw fail(400, 'Use at most 100 sentences.');
  return {
    language: input.language, position: input.position,
    title: string(input.title, 'Title', 160), titleEn: string(input.titleEn ?? '', 'English title', 160, false),
    icon: string(input.icon || '📚', 'Icon', 20), tip: string(input.tip ?? '', 'Teaching note', 3000, false),
    words: input.words.map(w => ({term: string(w?.term, 'Word', 300), fr: string(w?.fr, 'French meaning', 300), en: string(w?.en ?? '', 'English meaning', 300, false)})),
    sentences: input.sentences.map(s => {
      if (!Array.isArray(s?.distractors) || s.distractors.length > 12) throw fail(400, 'Use at most 12 distractors per sentence.');
      return { fr: string(s.fr, 'French prompt', 600), en: string(s.en ?? '', 'English prompt', 600, false), answer: string(s.answer, 'Answer', 600), distractors: s.distractors.map(d => string(d, 'Distractor', 100)) };
    })
  };
}
