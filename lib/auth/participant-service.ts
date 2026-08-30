import { generateAvatar } from '@/lib/avatar/generator';
import { getEnv } from '@/lib/config/env';
import {
  answerStatusForParticipant,
  createParticipantWithAvatar,
  findEventBySlug,
  findParticipantByNickname,
  findParticipantWithAvatar,
  isNicknameConflict,
} from '@/lib/db/repositories/participants';
import { inTransaction } from '@/lib/db/transaction';
import { AppError, UnauthorizedError } from '@/lib/http/errors';
import { hashSecret, verifySecret } from '@/lib/security/crypto';
import { clearThrottle, readThrottle, recordFailure, throttleSubject } from '@/lib/security/rate-limit';
import { normalizeNickname } from '@/lib/validation/nickname';
import { issueSession } from './session';

export type ParticipantAuthInput = { inviteCode: string; nickname: string; pin: string; ipAddress: string };

function publicAvatar(avatar: NonNullable<Awaited<ReturnType<typeof findParticipantWithAvatar>>>['avatar']) {
  return {
    generatorVersion: avatar.generatorVersion,
    catalogVersion: avatar.catalogVersion,
    traits: avatar.selectedTraits,
  };
}

export function participantView(row: NonNullable<Awaited<ReturnType<typeof findParticipantWithAvatar>>>) {
  return { id: row.participant.id, nickname: row.participant.nicknameDisplay, avatar: publicAvatar(row.avatar) };
}

async function currentEvent() {
  const event = await findEventBySlug(getEnv().EVENT_SLUG);
  if (!event) throw new AppError('event_unavailable', '행사 준비 중입니다. 잠시 후 다시 시도해 주세요.', 503);
  return event;
}

async function verifyInvite(inviteCode: string, ipAddress: string) {
  const event = await currentEvent();
  const subject = throttleSubject(ipAddress);
  const throttle = await readThrottle('invite', subject);
  if (throttle.blocked) throw new AppError('rate_limited', '잠시 기다린 뒤 다시 시도해 주세요.', 429, undefined, throttle.retryAfter);
  if (!event.registrationOpen || !(await verifySecret(event.inviteCodeHash, inviteCode))) {
    const failure = await recordFailure('invite', subject);
    throw new AppError('invalid_invitation', failure.blocked ? '잠시 기다린 뒤 다시 시도해 주세요.' : '입장 정보를 확인해 주세요.', failure.blocked ? 429 : 401, undefined, failure.retryAfter || undefined);
  }
  await clearThrottle('invite', subject);
  return event;
}

export async function registerParticipant(input: ParticipantAuthInput) {
  const nickname = normalizeNickname(input.nickname);
  const event = await verifyInvite(input.inviteCode, input.ipAddress);
  const existing = await findParticipantByNickname(event.id, nickname.key);
  if (existing) throw new AppError('nickname_taken', '이미 등록된 닉네임입니다. 재입장해 주세요.', 409, 'nickname');

  const avatarResult = generateAvatar(nickname.version, nickname.key);
  try {
    const row = await inTransaction(async (tx) => createParticipantWithAvatar({
      eventId: event.id,
      nicknameDisplay: nickname.display,
      nicknameKey: nickname.key,
      nicknameRuleVersion: nickname.version,
      pinHash: await hashSecret(input.pin),
      avatar: avatarResult,
    }, tx));
    const session = await issueSession('participant', row.participant.id, row.participant.authVersion);
    return { view: participantView(row), session };
  } catch (error) {
    if (isNicknameConflict(error)) throw new AppError('nickname_taken', '이미 등록된 닉네임입니다. 재입장해 주세요.', 409, 'nickname');
    throw error;
  }
}

export async function loginParticipant(input: ParticipantAuthInput) {
  const nickname = normalizeNickname(input.nickname);
  const event = await verifyInvite(input.inviteCode, input.ipAddress);
  const subject = throttleSubject(event.id, nickname.key, input.ipAddress);
  const throttle = await readThrottle('participant_login', subject);
  if (throttle.blocked) throw new AppError('rate_limited', '잠시 기다린 뒤 다시 시도해 주세요.', 429, undefined, throttle.retryAfter);
  const participant = await findParticipantByNickname(event.id, nickname.key);
  if (!participant || !(await verifySecret(participant.pinHash, input.pin))) {
    const failure = await recordFailure('participant_login', subject);
    throw new AppError('invalid_credentials', failure.blocked ? '잠시 기다린 뒤 다시 시도해 주세요.' : '입장 정보를 확인해 주세요.', failure.blocked ? 429 : 401, undefined, failure.retryAfter || undefined);
  }
  await clearThrottle('participant_login', subject);
  const row = await findParticipantWithAvatar(participant.id);
  if (!row) throw new UnauthorizedError();
  const session = await issueSession('participant', participant.id, participant.authVersion);
  return { view: participantView(row), session };
}

export async function lobbyView(participantId: string) {
  const row = await findParticipantWithAvatar(participantId);
  if (!row) throw new UnauthorizedError();
  return {
    ...participantView(row),
    answerStatus: await answerStatusForParticipant(row.participant.id, row.participant.eventId),
  };
}
