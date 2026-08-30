import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { adminSessions, pinResetGrants } from '@/db/schema';
import { issueSession } from '@/lib/auth/session';
import { createTestDatabase } from '@/tests/helpers/database';
import { adminFactory, eventFactory, participantFactory } from '@/tests/helpers/factories';

let adminCookie: string | undefined;
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => adminCookie ? { value: adminCookie } : undefined }) }));
const csrf = 'csrf-for-admin-api-contract-000000000000000';
const json = (path: string, body: unknown, ip = '127.0.0.32') => new Request(`http://localhost:3000${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-csrf-token': csrf, 'x-forwarded-for': ip }, body: JSON.stringify(body) });

describe('PIN reset API contract', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => { database = await createTestDatabase(); });
  beforeEach(async () => { await database.reset(); adminCookie = undefined; });
  afterAll(async () => database?.close());

  async function setup() {
    const event = await eventFactory(database.db, { slug: 'frontend-chat-3rd' }); const admin = await adminFactory(database.db, event.id); const participant = await participantFactory(database.db, event.id, { nicknameDisplay: '초기화대상', nicknameKey: '초기화대상' });
    const session = await issueSession('admin', admin.id, admin.authVersion); adminCookie = session.token;
    await database.db.update(adminSessions).set({ csrfHash: (await import('@/lib/security/csrf')).csrfDigest(csrf) }).where(eq(adminSessions.adminId, admin.id));
    return { event, admin, participant };
  }

  it('requires recent authentication or a valid password, returns one no-store code, and reissue revokes the old grant', async () => {
    const { participant } = await setup();
    const route = await import('@/app/api/admin/participants/[participantId]/pin-reset/route');
    await database.db.update(adminSessions).set({ authenticatedAt: new Date(Date.now() - 11 * 60_000) });
    expect((await route.POST(json(`/api/admin/participants/${participant.id}/pin-reset`, {}), { params: Promise.resolve({ participantId: participant.id }) })).status).toBe(403);
    const first = await route.POST(json(`/api/admin/participants/${participant.id}/pin-reset`, { password: 'a-test-admin-password' }), { params: Promise.resolve({ participantId: participant.id }) });
    expect(first.status).toBe(201); expect(first.headers.get('cache-control')).toContain('no-store');
    const firstBody = await first.json(); expect(firstBody.resetCode).toMatch(/^\d{8}$/); expect(new Date(firstBody.expiresAt).getTime()).toBeGreaterThan(Date.now() + 9 * 60_000);
    const second = await route.POST(json(`/api/admin/participants/${participant.id}/pin-reset`, {}), { params: Promise.resolve({ participantId: participant.id }) });
    expect(second.status).toBe(201);
    const grants = await database.db.select().from(pinResetGrants).where(eq(pinResetGrants.participantId, participant.id));
    expect(grants).toHaveLength(2); expect(grants[0].revokedAt).toBeInstanceOf(Date); expect(grants[1].codeHash).not.toMatch(/^\d{8}$/);
  });

  it('is one-time, expires after ten minutes, and revokes after five failed attempts', async () => {
    const { participant } = await setup(); const reset = await import('@/app/api/admin/participants/[participantId]/pin-reset/route'); const complete = await import('@/app/api/participants/pin-reset/complete/route');
    async function grant() { const response = await reset.POST(json(`/api/admin/participants/${participant.id}/pin-reset`, {}), { params: Promise.resolve({ participantId: participant.id }) }); return response.json() as Promise<{ resetCode: string }>; }
    const one = await grant();
    const payload = { inviteCode: 'test-invite-code-1234', nickname: '초기화대상', resetCode: one.resetCode, newPin: '654321', newPinConfirmation: '654321' };
    expect((await complete.POST(json('/api/participants/pin-reset/complete', payload))).status).toBe(204);
    expect((await complete.POST(json('/api/participants/pin-reset/complete', payload))).status).toBe(410);
    const expired = await grant(); await database.db.update(pinResetGrants).set({ expiresAt: new Date(Date.now() - 1000) }).where(and(eq(pinResetGrants.participantId, participant.id), isNull(pinResetGrants.revokedAt)));
    expect((await complete.POST(json('/api/participants/pin-reset/complete', { ...payload, resetCode: expired.resetCode }))).status).toBe(410);
    const limited = await grant();
    for (let index = 0; index < 4; index++) expect((await complete.POST(json('/api/participants/pin-reset/complete', { ...payload, resetCode: '00000000' }, `127.0.1.${index + 1}`))).status).toBe(401);
    expect((await complete.POST(json('/api/participants/pin-reset/complete', { ...payload, resetCode: '00000000' }, '127.0.1.5'))).status).toBe(410);
    expect((await complete.POST(json('/api/participants/pin-reset/complete', { ...payload, resetCode: limited.resetCode }))).status).toBe(410);
  });
});
