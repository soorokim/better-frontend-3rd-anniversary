CREATE TYPE question_sequence_status AS ENUM ('waiting', 'in_progress', 'completed');
CREATE TYPE presentation_completion_state AS ENUM ('presenting', 'revealed', 'excluded');

ALTER TABLE questions ADD COLUMN display_order integer;
WITH ordered_questions AS (
  SELECT id, row_number() OVER (PARTITION BY event_id ORDER BY created_at, id) AS position FROM questions
)
UPDATE questions SET display_order = ordered_questions.position FROM ordered_questions WHERE questions.id = ordered_questions.id;
ALTER TABLE questions ALTER COLUMN display_order SET NOT NULL;
ALTER TABLE questions ADD CONSTRAINT questions_display_order_check CHECK (display_order BETWEEN 1 AND 4);
DROP INDEX IF EXISTS questions_one_published_uq;
CREATE UNIQUE INDEX questions_event_order_uq ON questions(event_id, display_order);

CREATE TABLE question_sequence_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  current_question_id uuid REFERENCES questions(id) ON DELETE SET NULL,
  status question_sequence_status NOT NULL DEFAULT 'waiting', revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE presentation_items ADD COLUMN completion_state presentation_completion_state NOT NULL DEFAULT 'presenting';
ALTER TABLE presentation_items ADD COLUMN completed_at timestamptz;
ALTER TABLE presentation_items ADD COLUMN exclusion_note text;
UPDATE presentation_items SET completion_state = 'revealed', completed_at = first_presented_at;
