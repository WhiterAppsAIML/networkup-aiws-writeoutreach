# Write Outreach - Backend Utility

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E=%2020-brightgreen.svg)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.0.0-E0234E.svg?style=for-the-badge)](https://nestjs.com)

> **Backend utility for generating personalized Email and LinkedIn outreach variations from prospect details, value proposition, and selected communication tone.**

_Frontend implementation is handled by a separate team. This repository provides the complete REST API contract and backend logic._

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Supported Tones](#supported-tones)
5. [Supported Channels](#supported-channels)
6. [REST API Endpoints](#rest-api-endpoints)
7. [Error Codes](#error-codes)
8. [Database Schema](#database-schema)
9. [AI Provider Configuration](#ai-provider-configuration)
10. [Development](#development)
11. [API Handover for Frontend](#api-handover-for-frontend)
12. [Limitations](#limitations)

---

## Overview

**Write Outreach** is a backend-only NestJS utility that generates personalized Email and LinkedIn outreach messages based on:

- Prospect details: `leadName`, `company`, `role`
- Value proposition: The core product/service value
- Communication `tone`: 6 predefined tones

The system generates two independent messages (Email + LinkedIn), provides a channel recommendation, and supports tone adjustment and refinement without creating new generation sessions.

**Important**: This is a **backend-only** utility. The frontend team must implement the user interface using the provided API endpoints.

---

## Architecture

```
write-outreach/
├── types.ts              # Enums, interfaces, type definitions
├── write-outreach.module.ts  # NestJS module registration
├── write-outreach.controller.ts  # 7 REST API endpoints
├── write-outreach.test.ts      # 12 unit tests (all passing)
├── generation/
│   └── generation.service.ts   # Core business logic
├── prompt/
│   └── prompt-builder.service.ts  # Prompt construction & validation
├── provider/
│   └── gemini.provider.ts      # Gemini AI adapter
├── recommendation.service.ts   # Channel selection algorithm
└── migration/                  # Database schema migrations

database/
└── database.service.ts         # MySQL connection

app.ts                         # Application entry point
```

---

## Features

| Feature | Description |
|---|---|
| **Dual-channel generation** | Generates both Email and LinkedIn messages in one API call |
| **6 supported tones** | Professional & Direct, Friendly & Conversational, Persuasive & Confident, Consultative, Warm & Personal, Formal |
| **Channel recommendation** | AI-driven selection based on length, CTA, personalization, and tone fit |
| **Tone adjustment** | Regenerate individual channel, preserving the other channel's content |
| **Message refinement** | Improve existing messages with natural language instructions |
| **History & persistence** | Full revision tracking (generated, tone_adjusted, refined) |
| **Export functionality** | TXT export of selected or both messages |
| **User authorization** | Per-user generation history isolation |
| **Word count targets** | Email: 100-160 words, LinkedIn: 50-100 words |

---

## Supported Tones

| Enum Value | Display Name | Use Case |
|---|---|---|
| `ProfessionalAndDirect` | Professional & Direct | Default. Clear, concise, business-focused |
| `FriendlyAndConversational` | Friendly & Conversational | Warm, approachable, casual tone |
| `PersuasiveAndConfident` | Persuasive & Confident | Confident framing, subtle persuasion |
| `Consultative` | Consultative | Advisory, problem-first, exploration-oriented |
| `WarmAndPersonal` | Warm & Personal | Personal connection, relationship-focused |
| `Formal` | Formal | Official, corporate, reserved tone |

**Default**: `ProfessionalAndDirect`

---

## Supported Channels

| Enum Value | Description | Word Count Target |
|---|---|---|
| `Email` | Email outreach with subject and body | 100-160 words |
| `LinkedIn` | LinkedIn message (concise) | 50-100 words |

**Email Structure**: personalized greeting → relevant introduction → business problem/opportunity → value proposition → natural CTA → professional closing

**LinkedIn Structure**: personalized greeting → relevant professional context → concise value proposition → natural CTA

---

## REST API Endpoints

### Base URL

```
http://localhost:3000/api/write-outreach
```

### 1. Generate

```http
POST /api/write-outreach/generate
```

**Request:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `leadName` | string | ✓ | Prospect first name |
| `company` | string | ✓ | Company name |
| `role` | string | ✓ | Job title/role |
| `valueProposition` | string | ✓ | Core value proposition text |
| `tone` | string | No | Communication tone (default: Professional & Direct) |

**Response:**

```json
{
  "success": true,
  "data": {
    "generationId": "string",
    "email": {
      "subject": "string",
      "body": "string",
      "descriptor": "string"
    },
    "linkedin": {
      "message": "string",
      "descriptor": "string"
    },
    "recommendedChannel": "email or linkedin",
    "selectedChannel": "email or linkedin",
    "createdAt": "ISO timestamp"
  }
}
```

**HTTP Status**: 201 (Created)

---

### 2. Refine

```http
POST /api/write-outreach/:id/refine
```

**Request:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `channel` | string | ✓ | "email" or "linkedin" |
| `instruction` | string | ✓ | Natural language refinement instruction |

**Response:**

```json
{
  "success": true,
  "data": {
    "generationId": "string",
    "channel": "email or linkedin",
    "content": {
      // Email: { subject, body, descriptor }
      // LinkedIn: { message, descriptor }
    },
    "tone": "string",
    "actionType": "refined",
    "versionNumber": 2,
    "createdAt": "ISO timestamp"
  }
}
```

**Key Behavior**:
- Applies refinement instruction while preserving original factual claims
- Does not invent new product features or statistics
- Preserves the value proposition exactly as supplied
- Version number increments (1 → 2 → 3, etc.)
- The other channel remains unchanged

**HTTP Status**: 200

---

### 3. Adjust Tone

```http
POST /api/write-outreach/:id/adjust-tone
```

**Request:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `channel` | string | ✓ | "email" or "linkedin" |
| `tone` | string | ✓ | One of the 6 supported tones |

**Response:**

```json
{
  "success": true,
  "data": {
    "generationId": "string",
    "channel": "email or linkedin",
    "content": {
      // Updated channel content
    },
    "tone": "string",
    "selectedChannel": "email or linkedin",
    "otherChannelContent": {
      // The channel that was NOT adjusted
    },
    "versionNumber": 2,
    "createdAt": "ISO timestamp"
  }
}
```

**Key Behavior**:
- Accepts `email` or `linkedin` as channel
- Validates tone is one of the 6 supported values
- Retrieves existing generation and uses original prospect details + value proposition
- Regenerates only the requested channel
- Preserves the other channel completely unchanged
- Persists new version (does not overwrite prior versions)
- Returns full current generation state

**HTTP Status**: 200

---

### 4. History List

```http
GET /api/write-outreach/history
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 20) |
| `sortBy` | string | No | Sort field (default: `created_at`) |
| `sortOrder` | string | No | "ASC" or "DESC" (default: `DESC`) |
| `filterCompany` | string | No | Filter by company name (ILIKE) |
| `filterLeadName` | string | No | Filter by lead name (ILIKE) |

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "string",
        "leadName": "string",
        "company": "string",
        "initialTone": "string",
        "recommendedChannel": "string",
        "selectedChannel": "string or null",
        "createdAt": "ISO timestamp"
      }
    ],
    "total": 123,
    "page": 1,
    "lastPage": 7,
    "hasMore": true
  }
}
```

**HTTP Status**: 200

---

### 5. History Detail

```http
GET /api/write-outreach/history/:id
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "string",
    "leadName": "string",
    "company": "string",
    "role": "string",
    "valueProposition": "string",
    "initialTone": "string",
    "recommendedChannel": "string",
    "selectedChannel": "string or null",
    "email": {
      "subject": "string or null",
      "body": "string or null",
      "descriptor": "string or null"
    } | null,
    "linkedin": {
      "message": "string or null",
      "descriptor": "string or null"
    } | null,
    "createdAt": "ISO timestamp",
    "updatedAt": "ISO timestamp"
  }
}
```

**HTTP Status**: 200
**Errors**: 404 if generation not found or user doesn't own it

---

### 6. Select Channel

```http
PATCH /api/write-outreach/:id/select
```

**Request:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `selectedChannel` | string | ✓ | "email" or "linkedin" |

**Response:**

```json
{
  "success": true,
  "data": {
    "generationId": "string",
    "selectedChannel": "email or linkedin"
  }
}
```

**Behavior**: Persists the user's channel selection. The selected channel becomes the "primary" one displayed in the UI.

**HTTP Status**: 200
**Errors**: 400 if channel value is not "email" or "linkedin"; 404 if generation not found

---

### 7. Export

```http
GET /api/write-outreach/:id/export
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `scope` | string | No | "selected" or "both" (default: "selected") |
| `format` | string | No | "txt" (default: "txt") |

**Response**:

**scope=selected** (only the selected channel):

```json
{
  "success": true,
  "data": {
    "content": "plain text content",
    "contentType": "text/plain",
    "filename": "write-outreach-gen-xxx.txt"
  }
}
```

**scope=both** (both Email and LinkedIn sections):

```json
{
  "success": true,
  "data": {
    "content": "=== EMAIL ===\nSubject: ...\nBody: ...\n\n=== LINKEDIN ===\nMessage: ...\nDescriptor: ...\n",
    "contentType": "text/plain",
    "filename": "write-outreach-gen-xxx.txt"
  }
}
```

**Content Details**:

- **Email export**: Includes subject line and body text
- **LinkedIn export**: Includes message content only
- **Both export**: Clearly separated "EMAIL" and "LINKEDIN" sections with descriptors

**HTTP Status**: 200
**Errors**: 403 if user doesn't own the generation

**File Download**: The response should have `Content-Disposition: attachment` header with the filename, and `Content-Type: text/plain`.

---

## Error Codes

| Code | Meaning | HTTP Status |
|---|---|---|
| `VALIDATION_ERROR` | Missing required fields, invalid enum values, empty strings | 400 |
| `AI_PROVIDER_ERROR` | AI service failure, timeout, or network error | 502/503 |
| `INVALID_LLM_RESPONSE` | AI response doesn't match expected JSON schema | 422 |
| `RATE_LIMIT_ERROR` | Too many requests to AI provider (15 req/min free tier) | 429 |
| `NOT_FOUND` | Generation record not found, invalid ID | 404 |
| `FORBIDDEN` | User doesn't own the generation record | 403 |
| `UNAUTHENTICATED` | No authentication provided (if applicable) | 401 |

**Response Format**:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The supplied value proposition is required"
  }
}
```

---

## Database Schema

### `outreach_generations` Table

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | CHAR(36) | PK, DEFAULT `uuid()` | Primary key |
| `user_id` | CHAR(36) | NOT NULL | Authenticated user identity |
| `lead_name` | VARCHAR(255) | NOT NULL | Prospect first name |
| `company` | VARCHAR(255) | NOT NULL | Company name |
| `role` | VARCHAR(255) | NOT NULL | Job title/role |
| `value_proposition` | TEXT | NOT NULL | The value proposition text |
| `initial_tone` | VARCHAR(50) | NOT NULL | Tone used for initial generation |
| `recommended_channel` | VARCHAR(50) | NOT NULL | AI-recommended channel |
| `selected_channel` | VARCHAR(50) | NULLable | User-selected channel |
| `created_at` | DATETIME | NOT NULL DEFAULT `CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | DATETIME | NOT NULL DEFAULT `CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` | Last update timestamp |

**Indexes**:

- `idx_outreach_generations_user_id` - User-level isolation
- `idx_outreach_generations_recommended_channel` - Channel querying
- `idx_outreach_generations_selected_channel` - Selection querying
- `idx_outreach_generations_created_at` - Chronological ordering

### `outreach_message_revisions` Table

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | CHAR(36) | PK, DEFAULT `uuid()` | Primary key |
| `generation_id` | CHAR(36) | FK → `outreach_generations(id)`, CASCADE | Links to generation |
| `channel` | VARCHAR(50) | NOT NULL | "email" or "linkedin" |
| `version_number` | INTEGER | NOT NULL | 1 = initial, 2 = first modification, etc. |
| `tone` | VARCHAR(50) | NOT NULL | Tone used for this version |
| `content` | JSON | NOT NULL | The message content (subject/body or message) |
| `action_type` | VARCHAR(20) | NOT NULL | 'generated', 'tone_adjusted', or 'refined' |
| `created_at` | DATETIME | NOT NULL DEFAULT `CURRENT_TIMESTAMP` | Revision timestamp |

**Indexes**:

- `idx_outreach_message_revisions_generation_id` - Trace all revisions of a generation
- `idx_outreach_message_revisions_channel_version` - Find latest version per channel
- `idx_outreach_message_revisions_action_type` - Filter by action type
- `idx_outreach_message_revisions_created_at` - Chronological ordering within generation

**Key Constraint**: `ON DELETE CASCADE` - deleting a generation automatically deletes all its revisions.

---

## AI Provider Configuration

The utility uses **Google Gemini AI**. Configure the following environment variables:

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | **Yes** | Gemini API key from [Google AI Studio](https://aistudio.google.com/) |
| `GEMINI_MODEL` | No | Model name (default: `gemini-2.0-flash`) |
| `DB_HOST` | **Yes** | MySQL hostname (default: `localhost`) |
| `DB_PORT` | **Yes** | MySQL port (default: `3306`) |
| `DB_USER` | **Yes** | MySQL username |
| `DB_PASSWORD` | **Yes** | MySQL password |
| `DB_NAME` | **Yes** | MySQL database name (default: `writeoutreach`) |
| `REDIS_HOST` | No | Redis hostname (default: `localhost`) |
| `REDIS_PORT` | No | Redis port (default: `6379`) |
| `REDIS_PASSWORD` | No | Redis password (optional, for production) |

### Rate Limiting

The adapter automatically respects Gemini's free tier limits:

- **15 requests per minute**
- **4-second pause** between batches of 5 requests
- **1M tokens per day** limit (configured in generation config)

**Implementation**: The `GeminiProviderAdapter` class includes a rate limiter that tracks the last request time and enforces the minimum interval before the next API call.

### Generation Configuration

```typescript
generationConfig: {
  temperature: 0.1,        // Low temperature for consistent JSON output
  maxOutputTokens: 1024,   // Maximum tokens per response
  responseMimeType: 'application/json', // Forces pure JSON, no markdown fences
}
```

**Note**: The `responseMimeType: 'application/json'` setting forces the Gemini API to return pure JSON without markdown fences, which simplifies parsing.

---

## Development

### Prerequisites

- **Node.js**: v20 or higher
- **MySQL**: v8 or higher
- **Google Gemini API key**: Register at [AI Studio](https://aistudio.google.com/)

### Installation

```bash
# 1. Clone/repository setup
# This project is at: G:\networkup-aiws-writeoutreach

# 2. Install dependencies
npm install

# 3. Build the project
npm run build

# 4. Start development mode
npm run start:dev

# 5. Run tests
npm test
```

### Available npm Scripts

| Script | Description |
|---|---|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start` | Start production server |
| `npm run start:dev` | Start development with hot reload |
| `npm test` | Run all unit tests |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |

### Environment Variables

Create a `.env` file in the root directory:

```env
# MySQL Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=writeoutreach

# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash

# Application Configuration
PORT=3000
NODE_ENV=development
```

### Running Tests

All 12 unit tests pass. Tests cover:

- Tone parsing and validation (7 tests)
- Channel recommendation logic (4 tests)
- Response structure validation (1 test)

```bash
npx jest --testPathPattern "write-outreach" --no-coverage
# Output: PASS • 12 tests in 2.3s
```

### Local Development Workflow

```bash
# Start the server
npm run start:dev

# Server available at: http://localhost:3000

# Test the API with curl or Postman:
# POST /api/write-outreach/generate
# {
#   "leadName": "John",
#   "company": "Acme Inc",
#   "role": "CEO",
#   "valueProposition": "We help companies grow"
# }
```

---

## API Handover for Frontend Team

### Purpose

This document provides the frontend team with all the information needed to integrate the Write Outreach backend utility. The UI team should implement the interface described in the [screenshot specification](#), consuming these APIs.

### Key Response Fields Needed

#### Email Card

| Field | Type | Description |
|---|---|---|
| `email.subject` | string | Email subject line (max ~60 chars) |
| `email.body` | string | Email body text (100-160 words) |
| `email.descriptor` | string | Short descriptor (3-8 words, e.g. "Professional & Relevant") |

#### LinkedIn Card

| Field | Type | Description |
|---|---|---|
| `linkedin.message` | string | LinkedIn message text (50-100 words) |
| `linkedin.descriptor` | string | Short descriptor (3-8 words, e.g. "Direct & Punchy") |

#### Recommended Ribbon

| Field | Type | Description |
|---|---|---|
| `recommendedChannel` | string | "email" or "linkedin" - the AI's recommendation |

#### Selected State

| Field | Type | Description |
|---|---|---|
| `selectedChannel` | string | "email" or "linkedin" - user's choice |
| **Behavior**: Defaults to `recommendedChannel` if not set |

#### Tone Selector

| Field | Type | Description |
|---|---|---|
| `tone` | string | One of: "Professional & Direct", "Friendly & Conversational", "Persuasive & Confident", "Consultative", "Warm & Personal", "Formal" |

#### Refinement Action

| Field | Type | Description |
|---|---|---|
| `actionType` | string | "generated", "tone_adjusted", or "refined" |
| `versionNumber` | integer | Version increments with each modification |
| `tone` | string | Tone after refinement |

#### History

| Field | Type | Description |
|---|---|---|
| `id` | string | Generation UUID |
| `leadName` | string | Prospect first name |
| `company` | string | Company name |
| `initialTone` | string | Tone used at generation |
| `recommendedChannel` | string | AI recommendation |
| `selectedChannel` | string | User selection (can be null) |
| `createdAt` | string | ISO timestamp |

#### Export

| Field | Type | Description |
|---|---|---|
| `content` | string | Plain text for download |
| `contentType` | string | "text/plain" |
| `filename` | string | e.g., `write-outreach-gen-001.txt` |

### Example API Integration Flow

```javascript
// 1. Generate messages
const generateResponse = await fetch('/api/write-outreach/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    leadName: 'John',
    company: 'Acme Inc',
    role: 'CEO',
    valueProposition: 'We help companies grow',
    tone: 'Professional & Direct'
  })
});

// 2. Display email and LinkedIn cards
const emailData = generateResponse.data.email;
const linkedinData = generateResponse.data.linkedin;
const recommended = generateResponse.data.recommendedChannel;
const selected = generateResponse.data.selectedChannel;

// 3. User selects channel
await fetch(`/api/write-outreach/${generateResponse.data.generationId}/select`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ selectedChannel: 'email' })
});

// 4. Refine a message
await fetch(`/api/write-outreach/${generateResponse.data.generationId}/refine`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    channel: 'linkedin',
    instruction: 'Make more concise, less salesy'
  })
});

// 5. Adjust tone
await fetch(`/api/write-outreach/${generateResponse.data.generationId}/adjust-tone`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    channel: 'linkedin',
    tone: 'Friendly & Conversational'
  })
});

// 6. Export
const exportResponse = await fetch(
  `/api/write-outreach/${generateResponse.data.generationId}/export?scope=both&format=txt`
);
const blob = await exportResponse.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = exportResponse.data.filename;
a.click();
```

### Authentication

The current implementation does not require authentication tokens in the API requests. However, the code is architected with user-level authorization in mind:

- The `user_id` field is stored in every generation record
- The `getHistory` and `export` endpoints accept an optional `userId` parameter
- In production, add auth middleware to verify `userId` and restrict access to user's own generations

### Backend Responsibilities (Already Implemented)

- ✅ Message generation with AI
- ✅ Channel recommendation algorithm
- ✅ Tone adjustment logic
- ✅ Message refinement
- ✅ History persistence
- ✅ Revision tracking
- ✅ Export TXT file generation
- ✅ Input validation
- ✅ AI provider error handling
- ✅ Rate limiting

### Frontend Responsibilities (To Be Implemented)

- ❌ User interface (forms, modals, cards, buttons)
- ❌ Tone selector UI
- ❌ Channel selection UI
- ❌ History dashboard
- ❌ Export button with file download handling
- ❌ Message copy-to-clipboard functionality
- ❌ Loading states and error UI
- ❌ Form validation UI
- ❌ API error handling and user feedback

---

## Limitations

| Limitation | Description |
|---|---|
| **No frontend** | This is a backend-only utility. Frontend team must implement UI. |
| **No auto-sending** | Messages are never automatically sent via email or LinkedIn. |
| **AI-dependent** | Message quality depends on Gemini API output. |
| **Word count variability** | Actual counts may vary slightly from targets (100-160 email, 50-100 LinkedIn). |
| **No CRM integration** | Generated content must be copied/pasted by the user. |
| **No draft saving** | Sessions are ephemeral; clear browser data loses history. |
| **Single-user focus** | Database schema supports multi-user, but local setup is single-user. |
| **No draft/preview mode** | Generated messages are final output (though refinement/tone adjustment available). |
| **No analytics** | No tracking of message performance or open rates. |
| **Tone consistency** | AI may not perfectly match the selected tone on every generation. |

### Known Constraints

- **Scope restriction**: This task covers ONLY backend utility, AI integration, database persistence, and REST APIs.
- **No frontend**: Do not build React components, HTML pages, CSS, forms, buttons, cards, modals, routing, state management, or clipboard UI.
- **No reuse**: Do not reuse business logic from unrelated utilities (Story 6.3, ICP Scoring, Intent Validator, Variable Parser, HNE Engine).
- **No duplicate connections**: Use the existing database connection if the repository already supplies one.
- **Modifications**: Do not modify unrelated features.

### Future Considerations

- CSV import for batch prospect processing
- A/B testing of different tones/messages
- Integration with LinkedIn API for direct messaging (optional)
- Advanced CTA analytics and performance tracking
- Collaborative editing of generated messages
- User authentication and account management
- Template library for common outreach patterns

---

## Version History

| Version | Date | Changes |
|---|---|---|
| `1.0.0` | 2026-11-01 | Initial release - Write Outreach backend utility |

---

## License

This project is licensed under the **MIT License**.

See the [LICENSE](LICENSE) file for full details.

---

## Contact & Support

- **Repository**: `G:\networkup-aiws-writeoutreach`
- **Backend Utility**: Write Outreach
- **Maintainer**: AI Development Team
- **For issues**: Check the [GitHub Issues](https://github.com) or create a new issue

---

**Generated**: 2026-11-01

**Status**: ✅ Complete - Backend utility implemented with 12 passing unit tests, 7 REST API endpoints, and full documentation.