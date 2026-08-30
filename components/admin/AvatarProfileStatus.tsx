type Summary = Awaited<ReturnType<typeof import('@/lib/auth/admin-service').adminAvatarProfileSummary>>;

export function AvatarProfileStatus({ summary }: { summary: Summary }) {
  if (!summary.activeBatch) return <div className="admin-empty">
    <p>활성 대화 프로필 배치가 아직 없습니다.</p>
    <p className="text-sm">서버에서 전원 분석과 검토를 마친 뒤 깨끗한 JSON을 가져와 주세요.</p>
  </div>;

  return <section aria-labelledby="avatar-profile-heading">
    <h2 id="avatar-profile-heading" className="text-xl font-bold">대화 아바타 준비 현황</h2>
    <dl className="avatar-batch-stats">
      <div><dt>원본 사용자 행</dt><dd>{summary.activeBatch.sourceUserCount}</dd></div>
      <div><dt>승인 프로필</dt><dd>{summary.activeBatch.profileCount}</dd></div>
      <div><dt>가입 연결</dt><dd>{summary.counts.claimed}</dd></div>
      <div><dt>승인 병합 행</dt><dd>{summary.counts.mergedSourceRows}</dd></div>
    </dl>
    <ul className="avatar-profile-list">
      {summary.profiles.map((profile) => <li key={profile.id}>
        <div><strong>{profile.nickname}</strong><span className="status-badge">{profile.claimed ? '가입됨' : '준비됨'}</span></div>
        <p>별칭: {profile.aliases.join(', ')}</p>
        <p>합쳐진 원본 행: {profile.sourceRowCount}</p>
      </li>)}
    </ul>
  </section>;
}
