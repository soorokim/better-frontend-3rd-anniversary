import { z } from 'zod';

export const NICKNAME_RULE_VERSION = 'nickname-key-v1';
const forbidden = /[\p{Cc}\p{Cf}\r\n]/u;
const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });

function assertValidUtf16(input: string): void {
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = input.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error('잘못된 문자 조합이 포함되어 있습니다.');
    } else if (code >= 0xdc00 && code <= 0xdfff) throw new Error('잘못된 문자 조합이 포함되어 있습니다.');
  }
}

export function normalizeNickname(input: string): { display: string; key: string; version: string } {
  assertValidUtf16(input);
  const display = input.normalize('NFC').trim();
  if (forbidden.test(display)) throw new Error('닉네임에 사용할 수 없는 문자가 있습니다.');
  const length = Array.from(segmenter.segment(display)).length;
  if (length < 1 || length > 24) throw new Error('닉네임은 1~24자로 입력해 주세요.');
  return { display, key: display.toLocaleLowerCase('und').normalize('NFC'), version: NICKNAME_RULE_VERSION };
}

export const nicknameSchema = z.string().superRefine((value, context) => {
  try { normalizeNickname(value); } catch (error) { context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : '닉네임을 확인해 주세요.' }); }
});
