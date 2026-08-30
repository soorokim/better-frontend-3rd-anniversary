CREATE TABLE presentation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  current_item_id uuid,
  author_revealed boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT presentation_sessions_question_uq UNIQUE (question_id)
);

CREATE INDEX presentation_sessions_event_idx ON presentation_sessions(event_id);

CREATE TABLE presentation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_session_id uuid NOT NULL REFERENCES presentation_sessions(id) ON DELETE CASCADE,
  answer_id uuid NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
  content_snapshot text NOT NULL CHECK (char_length(btrim(content_snapshot)) BETWEEN 1 AND 1000),
  answer_updated_at_snapshot timestamptz NOT NULL,
  nickname_snapshot text NOT NULL,
  avatar_snapshot jsonb NOT NULL,
  presentation_order integer NOT NULL CHECK (presentation_order > 0),
  first_presented_at timestamptz NOT NULL DEFAULT now(),
  last_selected_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT presentation_items_session_answer_uq UNIQUE (presentation_session_id, answer_id),
  CONSTRAINT presentation_items_session_order_uq UNIQUE (presentation_session_id, presentation_order)
);

CREATE INDEX presentation_items_answer_idx ON presentation_items(answer_id);

ALTER TABLE presentation_sessions
  ADD CONSTRAINT presentation_sessions_current_item_fk
  FOREIGN KEY (current_item_id) REFERENCES presentation_items(id) ON DELETE SET NULL;
