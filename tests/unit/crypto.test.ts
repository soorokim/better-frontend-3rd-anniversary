import { describe, expect, it } from 'vitest';
import { hashSecret, verifySecret } from '@/lib/security/crypto';

describe('secret hashing', () => {
  it('verifies the original secret and rejects a different one', async () => {
    const encoded = await hashSecret('한글-secret-123456');

    await expect(verifySecret(encoded, '한글-secret-123456')).resolves.toBe(true);
    await expect(verifySecret(encoded, 'wrong-secret')).resolves.toBe(false);
  });
});
