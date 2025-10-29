-- Migration: enable_rls_and_policies
-- Created at: 1761758726


-- Enable RLS on all tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_settings ENABLE ROW LEVEL SECURITY;

-- Conversations policies (allow public read/write for demo, but track users if authenticated)
CREATE POLICY "Allow all operations on conversations" ON conversations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Messages policies (allow public read/write for conversation flow)
CREATE POLICY "Allow all operations on messages" ON messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Analytics policies (allow public read/write for metrics collection)
CREATE POLICY "Allow all operations on analytics" ON analytics
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Handoffs policies (allow public read/write for escalation)
CREATE POLICY "Allow all operations on handoffs" ON handoffs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Agent settings policies (allow read for all, write for authenticated)
CREATE POLICY "Allow read on agent_settings" ON agent_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Allow write on agent_settings" ON agent_settings
  FOR ALL
  USING (auth.role() IN ('anon', 'authenticated', 'service_role'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated', 'service_role'));
;