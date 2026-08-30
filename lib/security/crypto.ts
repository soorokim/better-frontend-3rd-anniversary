import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { getEnv } from '@/lib/config/env';

function peppered(secret: string): Buffer {
  return createHmac('sha256', getEnv().AUTH_PEPPER).update(secret, 'utf8').digest();
}

export function randomToken(bytes = 32): string { return randomBytes(bytes).toString('base64url'); }
export function randomNumericCode(length: number): string {
  let result = '';
  while (result.length < length) result += String(randomInt(0, 10));
  return result;
}
export function digest(value: string): string { return createHash('sha256').update(value, 'utf8').digest('base64url'); }
export function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(digest(left)); const b = Buffer.from(digest(right));
  return a.length === b.length && timingSafeEqual(a, b);
}
export function hashSecret(secret: string): Promise<string> {
  return hash(peppered(secret), { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });
}
export function verifySecret(encoded: string, secret: string): Promise<boolean> {
  return verify(encoded, peppered(secret));
}
