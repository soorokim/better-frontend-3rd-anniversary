import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cleanConversationAnalysisSchema } from '@/lib/validation/conversation-profile';

export async function validateConversationProfiles(path: string) {
  const payload = cleanConversationAnalysisSchema.parse(JSON.parse(await readFile(resolve(path), 'utf8')));
  return {
    profiles: payload.profiles.length,
    sourceUserCount: payload.source_user_count,
    mergedSourceRows: payload.profiles.reduce(
      (sum, profile) => sum + (profile.source_row_count > 1 ? profile.source_row_count : 0),
      0,
    ),
  };
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error('사용법: npm run avatar:validate -- <profiles.json>');
  const result = await validateConversationProfiles(path);
  console.log(`검증 완료: 프로필 ${result.profiles}개 / 원본 사용자 행 ${result.sourceUserCount}개 / 승인 병합 행 ${result.mergedSourceRows}개`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : '프로필 파일 검증에 실패했습니다.');
    process.exitCode = 1;
  });
}
