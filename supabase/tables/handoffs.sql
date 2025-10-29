CREATE TABLE handoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    session_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    context_summary TEXT,
    collected_data JSONB DEFAULT '{}'::jsonb,
    sentiment_score NUMERIC,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);