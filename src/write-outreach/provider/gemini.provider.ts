// Write Outreach - AI Provider Adapter
// ====================================
// Separate provider adapter for the Google Gemini AI.
// Decouples prompt-building, business logic, and storage from a specific LLM SDK.
// Uses the already-configured Gemini model from the host repository.

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Tone, Channel, EmailContent, LinkedInContent, GenerationResponse, validateGenerationResponse } from './types';

// Read Gemini configuration from environment
function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('[WriteOutreach] Missing required environment variable: GEMINI_API_KEY');
  }
  return key;
}

function getGeminiModelName(): string {
  return process.env.GEMINI_MODEL || 'gemini-2.0-flash';
}

export class GeminiProviderAdapter {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(getGeminiApiKey());
    this.model = this.genAI.getGenerativeModel({
      model: getGeminiModelName(),
      generationConfig: {
        temperature: 0.1, // low temperature for consistent JSON output
        maxOutputTokens: 1024,
        responseMimeType: 'application/json', // forces pure JSON, no markdown fences
      },
    });
  }

  /** Invoke the AI provider with the given prompt and return parsed response */
  async generateContent(prompt: string): Promise<GenerationResponse> {
    // Check rate limit
    const now = Date.now();
    const lastRequest = (this as any).lastRequestTime || 0;
    const minInterval = 4000; // respects Gemini free tier: 15 req/min
    if (now - lastRequest < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - (now - lastRequest)));
    }
    (this as any).lastRequestTime = Date.now();

    try {
      const result = await this.model.generateContent(prompt);
      const rawText = result.response.text();

      // Strip any accidental markdown fences
      const cleaned = rawText.replace(/```json|```/gi, '').trim();

      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseError) {
        // Try to extract JSON from the response if it's not pure
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON found in LLM response');
        }
      }

      // Validate structured output
      if (!validateGenerationResponse(parsed)) {
        throw new Error('LLM response does not match expected schema');
      }

      return parsed as GenerationResponse;
    } catch (err) {
      const errorMessage = (err as Error).message || 'AI provider error';
      throw new Error(`AI provider failure: ${errorMessage}`);
    }
  }
}