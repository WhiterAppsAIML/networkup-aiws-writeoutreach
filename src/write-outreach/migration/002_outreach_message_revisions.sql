-- Write Outreach Migration 002: Create outreach_message_revisions table (if not already created)

-- This migration creates the message revision tracking table.
-- It references outreach_generations.generation_id with ON DELETE CASCADE.

CREATE TABLE IF NOT EXISTS outreach_message_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID NOT NULL REFERENCES outreach_generations(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL,
  version_number INTEGER NOT NULL,
  tone VARCHAR(50) NOT NULL,
  content JSONB NOT NULL,
  action_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on generation_id for tracing all revisions of a generation
CREATE INDEX IF NOT EXISTS idx_outreach_message_revisions_generation_id ON outreach_message_revisions(generation_id);

-- Index on channel + version for efficiently finding the latest version per channel
CREATE INDEX IF NOT EXISTS idx_outreach_message_revisions_channel_version ON outreach_message_revisions(generation_id, channel, version_number DESC);

-- Index on action_type for filtering revisions by type (generated vs adjusted vs refined)
CREATE INDEX IF NOT EXISTS idx_outreach_message_revisions_action_type ON outreach_message_revisions(action_type);

-- Index on created_at for chronological ordering within a generation
CREATE INDEX IF NOT EXISTS idx_outreach_message_revisions_created_at ON outreach_message_revisions(created_at DESC);