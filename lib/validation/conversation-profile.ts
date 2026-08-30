import { z } from 'zod';

const signal = z.number().min(0).max(1);
const percentage = z.number().min(0).max(100);
const nonNegative = z.number().min(0);

export const conversationSignalsSchema = z.object({
  attachments: signal,
  cheer: signal,
  code: signal,
  consistency: signal,
  curiosity: signal,
  links: signal,
  night: signal,
  story: signal,
  volume: signal,
}).strict();

const metricsSchema = z.object({
  messages: z.number().int().min(1),
  active_days: z.number().int().min(0),
  span_days: z.number().int().min(0),
  messages_per_active_day: nonNegative,
  top_day_share: signal,
  avg_chars: nonNegative,
  median_chars: nonNegative,
  p90_chars: z.number().int().min(0),
  question_pct: percentage,
  laughter_pct: percentage,
  code_pct: percentage,
  night_pct: percentage,
  weekend_pct: percentage,
  top_hour: z.number().int().min(0).max(23).nullable(),
  links: z.number().int().min(0),
  attachments: z.number().int().min(0),
  links_per_100: nonNegative,
  attachments_per_100: nonNegative,
  first_date: z.iso.date().nullable(),
  last_date: z.iso.date().nullable(),
}).strict();

const topicRatesSchema = z.object({
  backend: nonNegative,
  design: nonNegative,
  frontend: nonNegative,
  infra: nonNegative,
  quality: nonNegative,
  tools: nonNegative,
}).strict();

export const conversationAnalysisProfileSchema = z.object({
  name: z.string().trim().min(1),
  source_aliases: z.array(z.string().trim().min(1)).min(1),
  source_row_count: z.number().int().min(1),
  metrics: metricsSchema,
  topic_rates_per_10k_chars: topicRatesSchema,
  conversation_digest: z.string().regex(/^[0-9a-f]{64}$/),
  signals: conversationSignalsSchema,
  adjective_candidates: z.array(z.string().trim().min(1)).max(3),
  noun_candidates: z.array(z.string().trim().min(1)).max(6),
}).strict().superRefine((profile, context) => {
  for (const [field, values] of [
    ['source_aliases', profile.source_aliases],
    ['adjective_candidates', profile.adjective_candidates],
    ['noun_candidates', profile.noun_candidates],
  ] as const) {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: 'custom', path: [field], message: '중복값을 포함할 수 없습니다.' });
    }
  }
});

const sourceUserSchema = z.object({
  user_id: z.number().int().min(1),
  display_name: z.string().min(1),
  message_count: z.number().int().min(1),
}).strict();

export const conversationAnalysisSchema = z.object({
  schema_version: z.literal('kakao-profile-analysis-v1'),
  privacy: z.object({
    contains_message_bodies: z.literal(false),
    conversation_digest: z.literal('hmac-sha256'),
  }).strict(),
  selection: z.literal('all-non-system-message-authors'),
  source_user_count: z.number().int().min(1),
  matched_count: z.number().int().min(0),
  unmatched: z.array(z.string()),
  alias_suggestions: z.record(z.string(), z.array(z.object({
    candidate: z.string(),
    messages: z.number().int().min(0),
    similarity: z.number().min(0).max(1),
  }).strict())),
  merge_review: z.array(z.object({
    nickname_key: z.string().min(1),
    source_users: z.array(sourceUserSchema).min(2),
  }).strict()),
  profiles: z.array(conversationAnalysisProfileSchema),
}).strict().superRefine((payload, context) => {
  if (payload.matched_count !== payload.profiles.length) {
    context.addIssue({ code: 'custom', path: ['matched_count'], message: '프로필 개수와 일치해야 합니다.' });
  }
  const aliases = payload.profiles.flatMap((profile) => profile.source_aliases);
  if (new Set(aliases).size !== aliases.length) {
    context.addIssue({ code: 'custom', path: ['profiles'], message: '별칭은 배치 안에서 한 프로필에만 속해야 합니다.' });
  }
});

export const cleanConversationAnalysisSchema = conversationAnalysisSchema.superRefine((payload, context) => {
  if (payload.unmatched.length) {
    context.addIssue({ code: 'custom', path: ['unmatched'], message: '미확인 참가자가 남아 있습니다.' });
  }
  if (payload.merge_review.length) {
    context.addIssue({ code: 'custom', path: ['merge_review'], message: '병합 검토가 남아 있습니다.' });
  }
  const rowCount = payload.profiles.reduce((sum, profile) => sum + profile.source_row_count, 0);
  if (rowCount !== payload.source_user_count) {
    context.addIssue({ code: 'custom', path: ['source_user_count'], message: '원본 사용자 행 합계와 일치해야 합니다.' });
  }
});

export type ConversationAnalysis = z.infer<typeof conversationAnalysisSchema>;
export type CleanConversationAnalysis = z.infer<typeof cleanConversationAnalysisSchema>;
export type ConversationAnalysisProfile = z.infer<typeof conversationAnalysisProfileSchema>;
