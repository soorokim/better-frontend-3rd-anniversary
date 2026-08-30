import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { cleanConversationAnalysisSchema } from '@/lib/validation/conversation-profile';
import { logger } from '@/lib/observability/logger';

describe('conversation avatar privacy boundary', () => {
  it('accepts only a body-free, user-id-free transfer profile contract', async () => {
    const raw = await readFile('tests/fixtures/avatar-analysis/valid-all-participants.json', 'utf8');
    const payload = cleanConversationAnalysisSchema.parse(JSON.parse(raw));
    const transfer = JSON.stringify(payload.profiles);
    for (const forbidden of ['"body"', '"user_id"', 'source_user_ids', 'pin', 'invite_code', 'session', 'AVATAR_HASH_KEY']) {
      expect(transfer).not.toContain(forbidden);
    }
  });

  it('redacts avatar analysis secrets if structured data reaches the logger', () => {
    const output = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    logger.info('avatar_import_test', {
      pin: '123456', inviteCode: 'private-invite', sessionToken: 'private-session',
      AVATAR_HASH_KEY: 'private-hmac', participantId: 'safe-id',
    });
    const line = String(output.mock.calls[0]?.[0]);
    expect(line).toContain('safe-id');
    for (const secret of ['123456', 'private-invite', 'private-session', 'private-hmac']) expect(line).not.toContain(secret);
  });

  it('does not print registration source, nickname, or credentials in throttle logs', () => {
    const output = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    logger.warn('participant_registration_throttled', {
      action: 'participant_register',
      ipAddress: '198.51.100.250',
      nickname: '비공개닉네임',
      pin: '654321',
      inviteCode: 'private-registration-invite',
    });
    const line = String(output.mock.calls[0]?.[0]);
    expect(line).toContain('participant_registration_throttled');
    expect(line).toContain('participant_register');
    for (const secret of ['198.51.100.250', '비공개닉네임', '654321', 'private-registration-invite']) {
      expect(line).not.toContain(secret);
    }
  });
});
