import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn, boolean, check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

export const avatarSourceKind = pgEnum('avatar_source_kind', ['nickname', 'conversation']);
export const questionStatus = pgEnum('question_status', ['draft', 'published', 'closed']);
export const questionSequenceStatus = pgEnum('question_sequence_status', ['waiting', 'in_progress', 'completed']);
export const presentationCompletionState = pgEnum('presentation_completion_state', ['presenting', 'revealed', 'excluded']);
export const throttleAction = pgEnum('throttle_action', ['invite', 'participant_login', 'admin_login', 'pin_reset']);
export const auditOutcome = pgEnum('audit_outcome', ['success', 'failure']);

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(), slug: text('slug').notNull(), title: text('title').notNull(),
  inviteCodeHash: text('invite_code_hash').notNull(), registrationOpen: boolean('registration_open').default(true).notNull(), ...timestamps,
}, (t) => [uniqueIndex('events_slug_uq').on(t.slug), check('events_title_length', sql`char_length(${t.title}) between 1 and 100`)]);

export const participants = pgTable('participants', {
  id: uuid('id').defaultRandom().primaryKey(), eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  nicknameDisplay: text('nickname_display').notNull(), nicknameKey: text('nickname_key').notNull(),
  nicknameRuleVersion: text('nickname_rule_version').default('nickname-key-v1').notNull(), pinHash: text('pin_hash').notNull(),
  authVersion: integer('auth_version').default(1).notNull(), currentAvatarId: uuid('current_avatar_id'), ...timestamps,
}, (t) => [uniqueIndex('participants_event_nickname_uq').on(t.eventId, t.nicknameKey), index('participants_event_idx').on(t.eventId), check('participants_auth_version_check', sql`${t.authVersion} >= 1`)]);

export const avatarAssignments = pgTable('avatar_assignments', {
  id: uuid('id').defaultRandom().primaryKey(), participantId: uuid('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  sourceKind: avatarSourceKind('source_kind').notNull(), sourceVersion: text('source_version').notNull(), sourceDigest: text('source_digest').notNull(),
  generatorVersion: text('generator_version').notNull(), catalogVersion: text('catalog_version').notNull(),
  selectedTraits: jsonb('selected_traits').$type<Record<string, string>>().notNull(), supersedesId: uuid('supersedes_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('avatar_participant_idx').on(t.participantId)]);

export const questions = pgTable('questions', {
  id: uuid('id').defaultRandom().primaryKey(), eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  prompt: text('prompt').notNull(), displayOrder: integer('display_order').notNull(), status: questionStatus('status').default('draft').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }), ...timestamps,
}, (t) => [index('questions_event_idx').on(t.eventId), uniqueIndex('questions_event_order_uq').on(t.eventId, t.displayOrder), check('questions_prompt_length', sql`char_length(btrim(${t.prompt})) between 1 and 500`), check('questions_display_order_check', sql`${t.displayOrder} between 1 and 4`)]);

export const answers = pgTable('answers', {
  id: uuid('id').defaultRandom().primaryKey(), participantId: uuid('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }), content: text('content').notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex('answers_participant_question_uq').on(t.participantId, t.questionId), check('answers_content_length', sql`char_length(btrim(${t.content})) between 1 and 1000`)]);

export const presentationSessions = pgTable('presentation_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  currentItemId: uuid('current_item_id').references((): AnyPgColumn => presentationItems.id, { onDelete: 'set null' }),
  authorRevealed: boolean('author_revealed').default(false).notNull(),
  revision: integer('revision').default(0).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('presentation_sessions_question_uq').on(t.questionId),
  index('presentation_sessions_event_idx').on(t.eventId),
  check('presentation_sessions_revision_check', sql`${t.revision} >= 0`),
]);

export const presentationItems = pgTable('presentation_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  presentationSessionId: uuid('presentation_session_id').notNull().references(() => presentationSessions.id, { onDelete: 'cascade' }),
  answerId: uuid('answer_id').notNull().references(() => answers.id, { onDelete: 'cascade' }),
  contentSnapshot: text('content_snapshot').notNull(),
  answerUpdatedAtSnapshot: timestamp('answer_updated_at_snapshot', { withTimezone: true }).notNull(),
  nicknameSnapshot: text('nickname_snapshot').notNull(),
  avatarSnapshot: jsonb('avatar_snapshot').$type<{
    generatorVersion: string;
    catalogVersion: string;
    traits: Record<string, string>;
  }>().notNull(),
  presentationOrder: integer('presentation_order').notNull(),
  completionState: presentationCompletionState('completion_state').default('presenting').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  exclusionNote: text('exclusion_note'),
  firstPresentedAt: timestamp('first_presented_at', { withTimezone: true }).defaultNow().notNull(),
  lastSelectedAt: timestamp('last_selected_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('presentation_items_session_answer_uq').on(t.presentationSessionId, t.answerId),
  uniqueIndex('presentation_items_session_order_uq').on(t.presentationSessionId, t.presentationOrder),
  index('presentation_items_answer_idx').on(t.answerId),
  check('presentation_items_content_length', sql`char_length(btrim(${t.contentSnapshot})) between 1 and 1000`),
  check('presentation_items_order_check', sql`${t.presentationOrder} > 0`),
]);

export const questionSequenceSessions = pgTable('question_sequence_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  currentQuestionId: uuid('current_question_id').references(() => questions.id, { onDelete: 'set null' }),
  status: questionSequenceStatus('status').default('waiting').notNull(),
  revision: integer('revision').default(0).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('question_sequence_sessions_event_uq').on(t.eventId),
  check('question_sequence_sessions_revision_check', sql`${t.revision} >= 0`),
]);

export const participantSessions = pgTable('participant_sessions', {
  id: uuid('id').defaultRandom().primaryKey(), participantId: uuid('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(), csrfHash: text('csrf_hash').notNull(), authVersion: integer('auth_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => [uniqueIndex('participant_sessions_token_uq').on(t.tokenHash), index('participant_sessions_owner_idx').on(t.participantId)]);

export const adminAccounts = pgTable('admin_accounts', {
  id: uuid('id').defaultRandom().primaryKey(), eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  username: text('username').notNull(), passwordHash: text('password_hash').notNull(), authVersion: integer('auth_version').default(1).notNull(), ...timestamps,
}, (t) => [uniqueIndex('admin_event_username_uq').on(t.eventId, t.username), check('admin_auth_version_check', sql`${t.authVersion} >= 1`)]);

export const adminSessions = pgTable('admin_sessions', {
  id: uuid('id').defaultRandom().primaryKey(), adminId: uuid('admin_id').notNull().references(() => adminAccounts.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(), csrfHash: text('csrf_hash').notNull(), authVersion: integer('auth_version').notNull(),
  authenticatedAt: timestamp('authenticated_at', { withTimezone: true }).defaultNow().notNull(), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => [uniqueIndex('admin_sessions_token_uq').on(t.tokenHash), index('admin_sessions_owner_idx').on(t.adminId)]);

export const pinResetGrants = pgTable('pin_reset_grants', {
  id: uuid('id').defaultRandom().primaryKey(), participantId: uuid('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(), failureCount: integer('failure_count').default(0).notNull(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }), revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdByAdminId: uuid('created_by_admin_id').notNull().references(() => adminAccounts.id), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('pin_reset_participant_idx').on(t.participantId), check('pin_reset_failures_check', sql`${t.failureCount} between 0 and 5`)]);

export const authThrottles = pgTable('auth_throttles', {
  id: uuid('id').defaultRandom().primaryKey(), action: throttleAction('action').notNull(), subjectKeyHash: text('subject_key_hash').notNull(),
  failureCount: integer('failure_count').default(0).notNull(), windowStartedAt: timestamp('window_started_at', { withTimezone: true }).defaultNow().notNull(),
  blockedUntil: timestamp('blocked_until', { withTimezone: true }), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex('auth_throttle_scope_uq').on(t.action, t.subjectKeyHash)]);

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').defaultRandom().primaryKey(), eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  adminId: uuid('admin_id').references(() => adminAccounts.id), action: text('action').notNull(), targetParticipantId: uuid('target_participant_id').references(() => participants.id),
  outcome: auditOutcome('outcome').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('audit_event_time_idx').on(t.eventId, t.createdAt)]);
