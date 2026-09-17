CREATE TABLE summaries (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  input_text TEXT NOT NULL,
  summary TEXT,
  classification JSONB,
  prompt_version VARCHAR(50),
  model VARCHAR(100),
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
