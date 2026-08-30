export function authCookieNames(secure: boolean) {
  const prefix = secure ? '__Host-' : '';
  return {
    participant: `${prefix}participant_session`,
    participantCsrf: `${prefix}participant_csrf`,
    admin: `${prefix}admin_session`,
  } as const;
}
