const redactedKeys = /password|pin|invite|reset.?code|token|session|csrf|answer|content|snapshot|nickname|author|avatar|hmac|hash.?key|secret|ip.?address|client.?ip|remote.?address|^ip$/i;

const presentationCommandTypes = new Set([
  'select_answer',
  'select_random',
  'set_author_visibility',
  'navigate',
  'restart',
  'advance_question',
  'publish_archive',
  'unpublish_archive',
]);

function sanitize(value: unknown): unknown {
  // Error messages can contain a validation input or a database value. Keep
  // the useful error class but never copy the free-form message into logs.
  if (value instanceof Error) {
    const databaseError = value as Error & { code?: unknown; constraint_name?: unknown; constraint?: unknown };
    const constraint = databaseError.constraint_name ?? databaseError.constraint;
    return {
      name: value.name,
      code: typeof databaseError.code === 'string' ? databaseError.code : undefined,
      constraint: typeof constraint === 'string' ? constraint : undefined,
      cause: databaseError.cause instanceof Error ? sanitize(databaseError.cause) : undefined,
    };
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactedKeys.test(key) ? '[REDACTED]' : sanitize(item)]));
  return value;
}

function write(level: 'info' | 'warn' | 'error', event: string, details?: unknown): void {
  const payload = JSON.stringify({ level, event, details: sanitize(details), at: new Date().toISOString() });
  if (level === 'error') console.error(payload); else if (level === 'warn') console.warn(payload); else console.info(payload);
}

function presentationCommand(command: unknown): void {
  const rawType = command && typeof command === 'object' && 'type' in command
    ? Reflect.get(command, 'type')
    : undefined;
  const commandType = typeof rawType === 'string' && presentationCommandTypes.has(rawType)
    ? rawType
    : 'unknown';

  // Commands can contain answer IDs or future payload fields. Log only the
  // finite action name so adding a command field cannot silently expand logs.
  write('info', 'presentation_command', { commandType });
}

export const logger = {
  info: (event: string, details?: unknown) => write('info', event, details),
  warn: (event: string, details?: unknown) => write('warn', event, details),
  error: (event: string, details?: unknown) => write('error', event, details),
  presentationCommand,
};
