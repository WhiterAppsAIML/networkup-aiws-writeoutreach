-- Write Outreach Migration 002: Create outreach_message_revisions table
-- Tracks all message generations and modifications (tone adjustments, refinements)
-- MySQL compatible: UUID as CHAR(36), JSON content

CREATE TABLE IF NOT EXISTS outreach_message_revisions (
  id CHAR(36) PRIMARY KEY,
  generation_id CHAR(36) NOT NULL,
  channel VARCHAR(50) NOT NULL,          -- 'email' or 'linkedin'
  version_number INTEGER NOT NULL,       -- 1 = initial, 2 = first adjustment, etc.
  tone VARCHAR(50) NOT NULL,             -- The tone used for this version
  content JSON NOT NULL,                 -- The generated/refined message content
  action_type VARCHAR(20) NOT NULL,      -- 'generated', 'tone_adjusted', 'refined'
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index on generation_id for tracing revisions
CREATE INDEX IF NOT EXISTS idx_outreach_message_revisions_generation_id ON outreach_message_revisions(generation_id);

-- Index on channel and version for querying latest versions
CREATE INDEX IF NOT EXISTS idx_outreach_message_revisions_channel_version ON outreach_message_revisions(generation_id, channel, version_number DESC);

-- Index on action_type for filtering
CREATE INDEX IF NOT EXISTS idx_outreach_message_revisions_action_type ON outreach_message_revisions(action_type);

-- Index on created_at for chronological ordering within a generation
CREATE INDEX IF NOT EXISTS idx_outreach_message_revisions_created_at ON outreach_message_revisions(created_at DESC);