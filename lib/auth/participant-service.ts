import { developerTraits } from '@/lib/avatar/developer-profile';
import { pixelAvatarUrl } from '@/lib/avatar/presentation';
import { getEnv } from '@/lib/config/env';
import {
  answerStatusForParticipant,
  assignConversationAvatar,
  createParticipantWithAvatar,
  findEventBySlug,
  findParticipantById,
  findParticipantByNickname,
  findParticipantWithAvatar,
  isNicknameConflict,
} from '@/lib/db/repositories/participants';
import {
  claimConversationProfile,
  findActiveConversationProfileBatch,
  findConversationProfile,
  resolveParticipantName,
} from '@/lib/db/repositories/conversation-profiles';
import { inTransaction } from '@/lib/db/transaction';
import { AppError, UnauthorizedError } from '@/lib/http/errors';
import { logger } from '@/lib/observability/logger';
import { hashSecret, verifySecret } from '@/lib/security/crypto';
import {
  clearThrottle,
  consumeRegistrationAttempt,
  readThrottle,
  recordFailure,
  throttleSubject,
} from '@/lib/security/rate-limit';
import { normalizeNickname } from '@/lib/validation/nickname';
import { issueSession } from './session';

export type ParticipantRegistrationInput = { inviteCode: string; nickname: string; pin: string; ipAddress: string };
export type ParticipantLoginInput = { nickname: string; pin: string; ipAddress: string };

function publicAvatar(avatar: NonNullable<Awaited<ReturnType<typeof findParticipantWithAvatar>>>['avatar']) {
  const statuses = (avatar.selectedTraits.developerStatuses ?? avatar.selectedTraits.developerStatus ?? '')
    .split('\n').filter(Boolean);
  const className = avatar.selectedTraits.developerAdjective && avatar.selectedTraits.developerNoun
    ? `${avatar.selectedTraits.developerAdjective} ${avatar.selectedTraits.developerNoun}`
    : null;
  return {
    sourceKind: avatar.sourceKind,
    generatorVersion: avatar.generatorVersion,
    catalogVersion: avatar.catalogVersion,
    traits: avatar.selectedTraits,
    className,
    item: avatar.selectedTraits.developerItem,
    status: avatar.selectedTraits.developerStatus,
    statuses,
    displayHash: avatar.selectedTraits.developerHash,
    avatarUrl: pixelAvatarUrl(avatar.selectedTraits),
  };
}

function avatarFromConversationProfile(profile: NonNullable<Awaited<ReturnType<typeof findConversationProfile>>>) {
  return {
    sourceKind: 'conversation' as const,
    sourceVersion: profile.sourceVersion,
    sourceDigest: profile.sourceDigest,
    generatorVersion: profile.profileData.generatorVersion,
    catalogVersion: 'pixel-parts-v1',
    traits: developerTraits(profile.profileData),
    conversationProfileId: profile.id,
  };
}

async function participantWithBestAvatar(participant: { id: string; eventId: string; nicknameKey: string }) {
  return inTransaction(async (tx) => {
    const current = await findParticipantWithAvatar(participant.id, tx);
    if (!current) return undefined;
    const profile = await findConversationProfile(participant.eventId, participant.nicknameKey, tx);
    if (current.avatar.sourceKind === 'conversation' && (!profile || current.avatar.sourceDigest === profile.sourceDigest)) return current;
    if (!profile || (profile.claimedParticipantId && profile.claimedParticipantId !== participant.id)) return current;
    if (!profile.claimedParticipantId && !(await claimConversationProfile(profile.id, participant.id, tx))) return current;
    await assignConversationAvatar({
      participantId: participant.id,
      supersedesId: current.avatar.id,
      ...avatarFromConversationProfile(profile),
    }, tx);
    return findParticipantWithAvatar(participant.id, tx);
  });
}

export function participantView(row: NonNullable<Awaited<ReturnType<typeof findParticipantWithAvatar>>>) {
  return { id: row.participant.id, nickname: row.participant.nicknameDisplay, avatar: publicAvatar(row.avatar) };
}

async function currentEvent() {
  const event = await findEventBySlug(getEnv().EVENT_SLUG);
  if (!event) throw new AppError('event_unavailable', '행사 준비 중입니다. 잠시 후 다시 시도해 주세요.', 503);
  return event;
}

async function verifyInvitationCode(inviteCode: string, ipAddress: string) {
  const event = await currentEvent();
  const subject = throttleSubject(ipAddress);
  const throttle = await readThrottle('invite', subject);
  if (throttle.blocked) throw new AppError('rate_limited', '잠시 기다린 뒤 다시 시도해 주세요.', 429, undefined, throttle.retryAfter);
  if (!event.registrationOpen || !(await verifySecret(event.inviteCodeHash, inviteCode))) {
    const failure = await recordFailure('invite', subject);
    throw new AppError('invalid_invitation', failure.blocked ? '잠시 기다린 뒤 다시 시도해 주세요.' : '초대 코드를 확인해 주세요.', failure.blocked ? 429 : 401, 'inviteCode', failure.retryAfter || undefined);
  }
  await clearThrottle('invite', subject);
  return event;
}

export async function verifyParticipantInvitation(input: { inviteCode: string; ipAddress: string }) {
  const event = await verifyInvitationCode(input.inviteCode, input.ipAddress);
  if (!(await findActiveConversationProfileBatch(event.id))) {
    throw new AppError('profile_batch_not_ready', '대화 프로필을 준비하고 있어요. 잠시 뒤 다시 입장해 주세요.', 503);
  }
  return { verified: true as const };
}

export async function registerParticipant(input: ParticipantRegistrationInput) {
  const requestedNickname = normalizeNickname(input.nickname);
  const event = await verifyInvitationCode(input.inviteCode, input.ipAddress);
  if (!(await findActiveConversationProfileBatch(event.id))) {
    throw new AppError('profile_batch_not_ready', '대화 프로필을 준비하고 있어요. 잠시 뒤 다시 입장해 주세요.', 503);
  }
  const subject = throttleSubject(event.id, requestedNickname.key, input.ipAddress);
  const currentThrottle = await readThrottle('participant_register', subject);
  if (currentThrottle.blocked) {
    logger.warn('participant_registration_throttled', { action: 'participant_register', outcome: 'blocked' });
    throw new AppError('rate_limited', '잠시 기다린 뒤 다시 시도해 주세요.', 429, undefined, currentThrottle.retryAfter);
  }

  const initialProfile = await findConversationProfile(event.id, requestedNickname.key);
  if (!initialProfile) {
    const attempt = await consumeRegistrationAttempt(subject);
    if (attempt.blocked) {
      logger.warn('participant_registration_throttled', { action: 'participant_register', outcome: 'blocked' });
      throw new AppError('rate_limited', '잠시 기다린 뒤 다시 시도해 주세요.', 429, undefined, attempt.retryAfter);
    }
    throw new AppError('nickname_not_invited', '단톡방에서 사용한 닉네임인지 확인해 주세요.', 403, 'nickname');
  }
  if (initialProfile.claimedParticipantId) {
    throw new AppError('nickname_taken', '이미 등록된 닉네임입니다. 재입장해 주세요.', 409, 'nickname');
  }
  const [requestedNameOwner, canonicalNameOwner] = await Promise.all([
    findParticipantByNickname(event.id, requestedNickname.key),
    requestedNickname.key === initialProfile.nicknameKey
      ? Promise.resolve(undefined)
      : findParticipantByNickname(event.id, initialProfile.nicknameKey),
  ]);
  if (requestedNameOwner || canonicalNameOwner) {
    throw new AppError('nickname_taken', '이미 등록된 닉네임입니다. 재입장해 주세요.', 409, 'nickname');
  }

  const attempt = await consumeRegistrationAttempt(subject);
  if (attempt.blocked) {
    logger.warn('participant_registration_throttled', { action: 'participant_register', outcome: 'blocked' });
    throw new AppError('rate_limited', '잠시 기다린 뒤 다시 시도해 주세요.', 429, undefined, attempt.retryAfter);
  }
  const pinHash = await hashSecret(input.pin);

  try {
    const row = await inTransaction(async (tx) => {
      if (!(await findActiveConversationProfileBatch(event.id, tx))) {
        throw new AppError('profile_batch_not_ready', '대화 프로필을 준비하고 있어요. 잠시 뒤 다시 입장해 주세요.', 503);
      }
      const profile = await findConversationProfile(event.id, requestedNickname.key, tx);
      if (!profile) throw new AppError('nickname_not_invited', '단톡방에서 사용한 닉네임인지 확인해 주세요.', 403, 'nickname');
      if (profile.claimedParticipantId) throw new AppError('nickname_taken', '이미 등록된 닉네임입니다. 재입장해 주세요.', 409, 'nickname');
      const [requestedNameOwner, canonicalNameOwner] = await Promise.all([
        findParticipantByNickname(event.id, requestedNickname.key, tx),
        requestedNickname.key === profile.nicknameKey
          ? Promise.resolve(undefined)
          : findParticipantByNickname(event.id, profile.nicknameKey, tx),
      ]);
      if (requestedNameOwner || canonicalNameOwner) {
        throw new AppError('nickname_taken', '이미 등록된 닉네임입니다. 재입장해 주세요.', 409, 'nickname');
      }
      const created = await createParticipantWithAvatar({
        eventId: event.id,
        nicknameDisplay: profile.nicknameDisplay,
        nicknameKey: profile.nicknameKey,
        nicknameRuleVersion: requestedNickname.version,
        pinHash,
        avatar: avatarFromConversationProfile(profile),
      }, tx);
      if (!(await claimConversationProfile(profile.id, created.participant.id, tx))) {
        throw new AppError('nickname_taken', '방금 다른 가입에 사용된 닉네임입니다. 재입장해 주세요.', 409, 'nickname');
      }
      return created;
    });
    const session = await issueSession('participant', row.participant.id, row.participant.authVersion);
    await clearThrottle('participant_register', subject);
    return { view: participantView(row), session };
  } catch (error) {
    if (isNicknameConflict(error)) throw new AppError('nickname_taken', '이미 등록된 닉네임입니다. 재입장해 주세요.', 409, 'nickname');
    throw error;
  }
}

export async function loginParticipant(input: ParticipantLoginInput) {
  const nickname = normalizeNickname(input.nickname);
  const event = await currentEvent();
  const subject = throttleSubject(event.id, nickname.key, input.ipAddress);
  const throttle = await readThrottle('participant_login', subject);
  if (throttle.blocked) throw new AppError('rate_limited', '잠시 기다린 뒤 다시 시도해 주세요.', 429, undefined, throttle.retryAfter);
  const resolution = await resolveParticipantName(event.id, nickname.key);
  const participant = resolution.status === 'resolved'
    ? await findParticipantById(resolution.participantId)
    : undefined;
  if (!participant || !(await verifySecret(participant.pinHash, input.pin))) {
    const failure = await recordFailure('participant_login', subject);
    throw new AppError('invalid_credentials', failure.blocked ? '잠시 기다린 뒤 다시 시도해 주세요.' : '입장 정보를 확인해 주세요.', failure.blocked ? 429 : 401, undefined, failure.retryAfter || undefined);
  }
  await clearThrottle('participant_login', subject);
  const row = await participantWithBestAvatar(participant);
  if (!row) throw new UnauthorizedError();
  const session = await issueSession('participant', participant.id, participant.authVersion);
  return { view: participantView(row), session };
}

export async function lobbyView(participantId: string) {
  const existing = await findParticipantWithAvatar(participantId);
  const row = existing ? await participantWithBestAvatar(existing.participant) : undefined;
  if (!row) throw new UnauthorizedError();
  return {
    ...participantView(row),
    answerStatus: await answerStatusForParticipant(row.participant.id, row.participant.eventId),
  };
}
