// Write Outreach - Generation Service
// ==================================
// Core service responsible for coordinating:
// 1. Input validation
// 2. Prompt construction
// 3. AI provider invocation
// 4. Structured output parsing
// 5. Business-rule validation
// 6. Database persistence
// 7. Standardized API response generation

import {
  Tone,
  Channel,
  GenerateInput,
  GenerateResponse,
  EmailContent,
  LinkedInContent,
  MessageRevision,
  ActionType,
  PaginationParams,
  PaginationResult,
  HistoryListItem,
  HistoryDetail,
  MessageRevision as RevisionRecord,
} from './types';
import { recommendChannel } from '../recommendation.service';
import { validateGenerationResponse, validateChannelContent } from './prompt/prompt-builder.service';

// Import database client - will be injected via constructor
// We use a simple interface for database operations
interface DatabaseClient {
  query: (sql: string, params?: any[]) => Promise<any>;
  transaction: (fn: (trx: DatabaseClient) => Promise<any>) => Promise<any>;
}

// Rate limiting state
const rateLimitState = {
  requests: 0,
  windowStart: Date.now(),
};

const MAX_REQUESTS_PER_MINUTE = 15; // Gemini free tier

async function checkRateLimit(): Promise<void> {
  const now = Date.now();
  if (now - rateLimitState.windowStart > 60000) {
    rateLimitState.requests = 0;
    rateLimitState.windowStart = now;
  }

  if (rateLimitState.requests >= MAX_REQUESTS_PER_MINUTE) {
    const waitTime = 60000 - (now - rateLimitState.windowStart) + 1000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    rateLimitState.requests = 0;
    rateLimitState.windowStart = Date.now();
  }
  rateLimitState.requests++;
}

/** Generation service - core business logic */
export class GenerationService {
  private db: DatabaseClient;
  private aiModel: any; // Google Generative AI model instance

  constructor(db: DatabaseClient, aiModel: any) {
    this.db = db;
    this.aiModel = aiModel;
  }

  /** Validate input fields */
  private validateInput(input: GenerateInput): { valid: boolean; error?: string } {
    if (!input.leadName || input.leadName.trim().length === 0) {
      return { valid: false, error: 'leadName is required' };
    }
    if (!input.company || input.company.trim().length === 0) {
      return { valid: false, error: 'company is required' };
    }
    if (!input.role || input.role.trim().length === 0) {
      return { valid: false, error: 'role is required' };
    }
    if (!input.valueProposition || input.valueProposition.trim().length === 0) {
      return { valid: false, error: 'valueProposition is required' };
    }
    if (input.tone && !Object.values(Tone).includes(input.tone)) {
      return { valid: false, error: 'Unsupported tone' };
    }
    return { valid: true };
  }

  /** Generate outreach messages */
  async generate(input: GenerateInput): Promise<GenerateResponse> {
    // Step 1: Validate input
    const validation = this.validateInput(input);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error,
        },
      };
    }

    // Step 2: Check rate limit
    await checkRateLimit();

    // Step 3: Determine tone (default to Professional & Direct)
    const tone: Tone = input.tone || Tone.ProfessionalAndDirect;

    // Step 4: Build prompts
    const selectedChannel = Channel.Email; // We generate both channels
    const userPrompt = buildUserPrompt(
      input.leadName,
      input.company,
      input.role,
      input.valueProposition,
      tone,
      selectedChannel
    );

    // Step 5: Call AI provider
    let aiResponse: any;
    try {
      const result = await this.aiModel.generateContent({
        prompt: userPrompt,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      });
      aiResponse = result.response;
    } catch (err) {
      // Handle AI provider failures
      const errorMessage = (err as Error).message || 'AI provider error';
      return {
        success: false,
        error: {
          code: 'AI_PROVIDER_ERROR',
          message: errorMessage,
        },
      };
    }

    // Step 6: Parse structured output
    let parsedResponse: any;
    try {
      const rawText = aiResponse.text();
      // Strip any markdown fences if present
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      parsedResponse = JSON.parse(cleaned);
    } catch (err) {
      // Handle invalid LLM response
      return {
        success: false,
        error: {
          code: 'INVALID_LLM_RESPONSE',
          message: 'Failed to parse AI response as structured JSON',
        },
      };
    }

    // Step 7: Validate parsed response
    if (!validateGenerationResponse(parsedResponse)) {
      return {
        success: false,
        error: {
          code: 'INVALID_LLM_RESPONSE',
          message: 'AI response does not match expected schema',
        },
      };
    }

    // Step 8: Generate recommendation
    const prospectContext = {
      leadName: input.leadName,
      company: input.company,
      role: input.role,
    };
    const recommendedChannel = await recommendChannel(
      parsedResponse.email.body,
      parsedResponse.linkedin.message,
      prospectContext,
      tone
    );

    // Step 9: Persist to database
    const generationId = await this.persistGeneration(
      input,
      tone,
      parsedResponse,
      recommendedChannel
    );

    // Step 10: Return standardized response
    return {
      success: true,
      data: {
        generationId,
        email: {
          subject: parsedResponse.email.subject,
          body: parsedResponse.email.body,
          descriptor: parsedResponse.email.descriptor,
        },
        linkedin: {
          message: parsedResponse.linkedin.message,
          descriptor: parsedResponse.linkedin.descriptor,
        },
        recommendedChannel,
        selectedChannel,
        createdAt: new Date(),
      },
    };
  }

  /** Persist the generation to the database */
  private async persistGeneration(
    input: GenerateInput,
    tone: Tone,
    response: GenerationResponse,
    recommendedChannel: Channel
  ): Promise<string> {
    const selectedChannel = recommendedChannel;

    // Insert into outreach_generations table
    const generationId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`; // UUID-like ID

    await this.db.query(
      `INSERT INTO outreach_generations (
        id, user_id, lead_name, company, role, value_proposition,
        initial_tone, recommended_channel, selected_channel, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
      )`,
      [
        generationId,
        input.userId || 'anonymous', // Will be overridden by auth middleware
        input.leadName,
        input.company,
        input.role,
        input.valueProposition,
        tone,
        recommendedChannel,
        selectedChannel,
      ]
    );

    // Insert initial revisions for both channels
    const emailContent: LinkedInContent | EmailContent = {
      subject: response.email.subject,
      body: response.email.body,
      descriptor: response.email.descriptor,
    };

    const linkedinContent: LinkedInContent | EmailContent = {
      message: response.linkedin.message,
      descriptor: response.linkedin.descriptor,
    };

    // Insert email revision (version 1)
    await this.db.query(
      `INSERT INTO outreach_message_revisions (
        id, generation_id, channel, version_number, tone, content, action_type, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, NOW()
      )`,
      [
        `${generationId}-email-1`,
        generationId,
        Channel.Email,
        1,
        tone,
        JSON.stringify({
          subject: response.email.subject,
          body: response.email.body,
          descriptor: response.email.descriptor,
        }),
        ActionType.Generated,
      ]
    );

    // Insert LinkedIn revision (version 1)
    await this.db.query(
      `INSERT INTO outreach_message_revisions (
        id, generation_id, channel, version_number, tone, content, action_type, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, NOW()
      )`,
      [
        `${generationId}-linkedin-1`,
        generationId,
        Channel.LinkedIn,
        1,
        tone,
        JSON.stringify({
          message: response.linkedin.message,
          descriptor: response.linkedin.descriptor,
        }),
        ActionType.Generated,
      ]
    );

    return generationId;
  }

  /** Get a generation by ID */
  async getGeneration(id: string, userId: string): Promise<any> {
    const generation = await this.db.query(
      `SELECT * FROM outreach_generations WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (!generation || generation.length === 0) {
      return null;
    }

    const gen = generation[0];

    // Get current email revision
    const emailRevision = await this.db.query(
      `SELECT content FROM outreach_message_revisions WHERE generation_id = $1 AND channel = $2 ORDER BY version_number DESC LIMIT 1`,
      [gen.id, Channel.Email]
    );

    const linkedinRevision = await this.db.query(
      `SELECT content FROM outreach_message_revisions WHERE generation_id = $1 AND channel = $2 ORDER BY version_number DESC LIMIT 1`,
      [gen.id, Channel.LinkedIn]
    );

    return {
      ...gen,
      email: emailRevision?.[0] ? JSON.parse(emailRevision[0].content) : null,
      linkedin: linkedinRevision?.[0] ? JSON.parse(linkedinRevision[0].content) : null,
    };
  }

  /** Get user's generation history with pagination */
  async getHistory(
    userId: string,
    params: PaginationParams = {}
  ): Promise<PaginationResult<HistoryListItem>> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    // Build filter conditions
    const filterConditions: string[] = ['user_id = $1'];
    const paramsArr: any[] = [userId];

    if (params.filterCompany) {
      filterConditions.push(`company ILIKE $${paramsArr.length + 1}`);
      paramsArr.push(params.filterCompany);
    }
    if (params.filterLeadName) {
      filterConditions.push(`lead_name ILIKE $${paramsArr.length + 1}`);
      paramsArr.push(params.filterLeadName);
    }

    const whereClause = filterConditions.join(' AND ');

    // Count total
    const countResult = await this.db.query(
      `SELECT COUNT(*) as total FROM outreach_generations WHERE ${whereClause}`,
      paramsArr
    );
    const total = countResult?.[0]?.total || 0;

    // Get items
    const items = await this.db.query(
      `SELECT id, lead_name, company, initial_tone, recommended_channel, selected_channel, created_at 
       FROM outreach_generations 
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramsArr.length + 1} OFFSET $${paramsArr.length + 2}`,
      [...paramsArr, limit]
    );

    const lastPage = Math.ceil(total / limit);
    const hasMore = (page < lastPage) || (offset + items.length > 0);

    return {
      items: items.map((g: any) => ({
        id: g.id,
        leadName: g.lead_name,
        company: g.company,
        initialTone: g.initial_tone as Tone,
        recommendedChannel: g.recommended_channel as Channel,
        selectedChannel: g.selected_channel as Channel | null,
        createdAt: g.created_at,
      })),
      total,
      page,
      lastPage,
      hasMore,
    };
  }

  /** Get all revisions for a generation */
  async getRevisions(
    generationId: string,
    userId: string
  ): Promise<MessageRevision[]> {
    // First verify the generation belongs to the user
    const generation = await this.db.query(
      `SELECT id FROM outreach_generations WHERE id = $1 AND user_id = $2`,
      [generationId, userId]
    );

    if (!generation || generation.length === 0) {
      return [];
    }

    const revisions = await this.db.query(
      `SELECT id, generation_id, channel, version_number, tone, content, action_type, created_at 
       FROM outreach_message_revisions 
       WHERE generation_id = $1 
       ORDER BY created_at ASC`,
      [generationId]
    );

    return revisions.map((r: any) => ({
      id: r.id,
      generationId: r.generation_id,
      channel: r.channel as Channel,
      versionNumber: r.version_number,
      tone: r.tone as Tone,
      content: JSON.parse(r.content),
      actionType: r.action_type as ActionType,
      createdAt: r.created_at,
    }));
  }
}