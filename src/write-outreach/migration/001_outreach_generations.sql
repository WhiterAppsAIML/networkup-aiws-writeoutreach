-- Write Outreach Migration 001: Create outreach_generations table
-- Creates the main table for storing outreach generation data
-- MySQL compatible: UUID as CHAR(36), TIMESTAMPTZ as DATETIME

CREATE TABLE IF NOT EXISTS outreach_generations (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  lead_name VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  value_proposition TEXT NOT NULL,
  initial_tone VARCHAR(50) NOT NULL,
  recommended_channel VARCHAR(50) NOT NULL,
  selected_channel VARCHAR(50),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Index on user_id for user-level history isolation
CREATE INDEX IF NOT EXISTS idx_outreach_generations_user_id ON outreach_generations(user_id);

-- Index on recommended_channel for querying
CREATE INDEX IF NOT EXISTS idx_outreach_generations_recommended_channel ON outreach_generations(recommended_channel);

-- Index on selected_channel for querying
CREATE INDEX IF NOT EXISTS idx_outreach_generations_selected_channel ON outreach_generations(selected_channel);

-- Index on created_at for chronological ordering
CREATE INDEX IF NOT EXISTS idx_outreach_generations_created_at ON outreach_generations(created_at DESC);

-- --------------------------------------------------------

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