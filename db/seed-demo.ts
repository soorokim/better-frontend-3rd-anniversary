import { and, asc, eq } from 'drizzle-orm';
import { answers, avatarAssignments, events, participants, questions } from './schema';
import { closeDatabase, db } from '../lib/db/client';
import { generateAvatar } from '../lib/avatar/generator';
import { getEnv } from '../lib/config/env';
import { hashSecret } from '../lib/security/crypto';
import { normalizeNickname } from '../lib/validation/nickname';

const demoParticipants = [
  { nickname: '리액트요정', answer: '올해는 다 같이 새벽까지 배포 장애를 잡던 날이 제일 기억나요. 힘들었는데 이상하게 재미있었어요.' },
  { nickname: 'CSS마법사', answer: '질문 하나 올렸을 뿐인데 각자 다른 방식으로 풀어줘서, 프론트엔드에는 정답이 하나가 아니라는 걸 다시 느꼈어요.' },
  { nickname: '타입수호자', answer: '처음 타입스크립트를 물어봤던 때보다 지금은 제가 다른 사람의 타입 오류를 같이 봐주고 있다는 게 신기해요.' },
  { nickname: '픽셀고양이', answer: '회사도 프로젝트도 바뀌었지만 이 방은 그대로 남아 있어서 좋았습니다. 가끔 들어와도 어색하지 않은 곳 같아요.' },
  { nickname: '버그헌터', answer: '금요일 밤에 올라온 “이거 왜 안 되죠?” 한마디로 시작해서 열 명이 디버깅하던 순간이요 🐛' },
  { nickname: '웹접근성지킴이', answer: '작은 토이 프로젝트에도 키보드 탐색과 스크린 리더를 챙기는 사람이 늘어난 게 올해 가장 반가웠어요.' },
  { nickname: '주니어개발자', answer: '사소해 보일까 봐 망설였던 질문에도 진지하게 답해 줘서 계속 개발할 수 있었어요. 정말 고마웠습니다.' },
  { nickname: '성능탐정', answer: '이미지 한 장 때문에 LCP가 느려진 원인을 다 같이 찾아낸 날. 그 뒤로 워터폴만 보면 그 대화가 생각나요.' },
  { nickname: '커피앤코드', answer: '온라인에서만 보던 사람들을 실제로 만나 코딩 얘기보다 사는 얘기를 더 오래 했던 첫 모임이 기억에 남아요.' },
  { nickname: '배포는금요일', answer: '3년 동안 쌓인 질문과 답변이 누군가의 검색 결과가 아니라 우리끼리의 기억으로 남아 있다는 게 좋네요.' },
  { nickname: '세미콜론', answer: null },
  { nickname: '노드산책러', answer: null },
] as const;

async function seedDemo() {
  if (process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('데모 데이터는 ALLOW_DEMO_SEED=true일 때만 생성할 수 있습니다.');
  }

  const demoPin = process.env.DEMO_PARTICIPANT_PIN;
  if (!demoPin || !/^\d{6}$/.test(demoPin)) {
    throw new Error('DEMO_PARTICIPANT_PIN을 숫자 6자리로 설정해 주세요.');
  }

  const env = getEnv();
  const [event] = await db.select().from(events).where(eq(events.slug, env.EVENT_SLUG)).limit(1);
  if (!event) throw new Error('먼저 npm run db:seed로 행사를 생성해 주세요.');

  const questionRows = await db.select().from(questions).where(and(
    eq(questions.eventId, event.id),
    eq(questions.status, 'published'),
  )).orderBy(asc(questions.displayOrder));
  if (questionRows.length !== 4) throw new Error('답변 가능한 질문 네 개가 필요합니다.');

  const pinHash = await hashSecret(demoPin);
  await db.transaction(async (tx) => {
    for (const demo of demoParticipants) {
      const nickname = normalizeNickname(demo.nickname);
      await tx.insert(participants).values({
        eventId: event.id,
        nicknameDisplay: nickname.display,
        nicknameKey: nickname.key,
        nicknameRuleVersion: nickname.version,
        pinHash,
      }).onConflictDoNothing({ target: [participants.eventId, participants.nicknameKey] });

      const [participant] = await tx.select().from(participants).where(and(
        eq(participants.eventId, event.id),
        eq(participants.nicknameKey, nickname.key),
      )).limit(1);
      if (!participant) throw new Error(`${demo.nickname} 참가자를 만들지 못했습니다.`);

      if (!participant.currentAvatarId) {
        const avatar = generateAvatar(nickname.version, nickname.key);
        const [assignment] = await tx.insert(avatarAssignments).values({
          participantId: participant.id,
          sourceKind: 'nickname',
          sourceVersion: nickname.version,
          sourceDigest: avatar.sourceDigest,
          generatorVersion: avatar.generatorVersion,
          catalogVersion: avatar.catalogVersion,
          selectedTraits: avatar.traits,
        }).returning();
        await tx.update(participants).set({ currentAvatarId: assignment.id, updatedAt: new Date() })
          .where(eq(participants.id, participant.id));
      }

      if (demo.answer) {
        for (const question of questionRows) {
          await tx.insert(answers).values({
            participantId: participant.id,
            questionId: question.id,
            content: question.displayOrder === 1 ? demo.answer : `${question.prompt}에 대해 ${demo.nickname}가 남긴 이야기입니다. ${demo.answer}`,
          }).onConflictDoNothing({ target: [answers.participantId, answers.questionId] });
        }
      }
    }
  });

  console.log(`데모 참가자 ${demoParticipants.length}명과 답변 ${demoParticipants.filter((demo) => demo.answer).length}개를 준비했습니다.`);
}

seedDemo()
  .finally(closeDatabase)
  .catch((error) => {
    console.error('데모 데이터 생성 실패');
    console.error(error instanceof Error ? error.message : '알 수 없는 오류');
    process.exitCode = 1;
  });
