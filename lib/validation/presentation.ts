import { z } from 'zod';

const selectAnswerCommandSchema = z.object({
  type: z.literal('select_answer'),
  answerId: z.string().uuid(),
}).strict();

const selectRandomCommandSchema = z.object({
  type: z.literal('select_random'),
}).strict();

const setAuthorVisibilityCommandSchema = z.object({
  type: z.literal('set_author_visibility'),
  revealed: z.boolean(),
}).strict();

const navigateCommandSchema = z.object({
  type: z.literal('navigate'),
  direction: z.enum(['previous', 'next']),
}).strict();

const restartCommandSchema = z.object({
  type: z.literal('restart'),
  confirmed: z.literal(true),
}).strict();

const advanceQuestionCommandSchema = z.object({ type: z.literal('advance_question') }).strict();
const publishArchiveCommandSchema = z.object({ type: z.literal('publish_archive') }).strict();

export const presentationCommandSchema = z.discriminatedUnion('type', [
  selectAnswerCommandSchema,
  selectRandomCommandSchema,
  setAuthorVisibilityCommandSchema,
  navigateCommandSchema,
  restartCommandSchema,
  advanceQuestionCommandSchema,
  publishArchiveCommandSchema,
]);

export type PresentationCommand = z.infer<typeof presentationCommandSchema>;
