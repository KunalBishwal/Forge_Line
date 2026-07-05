import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * AI Summary Service — generates human-readable error summaries
 * by sending error messages/stack traces to an LLM API.
 *
 * Supports Gemini API. Non-blocking — failures here do NOT
 * affect job processing. This is a best-effort bonus feature.
 */
@Injectable()
export class AiSummaryService {
  private readonly logger = new Logger(AiSummaryService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly provider: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('AI_API_KEY', '');
    this.model = this.config.get<string>('AI_MODEL', 'gemini-2.0-flash');
    this.provider = this.config.get<string>('AI_PROVIDER', 'gemini');
  }

  /**
   * Sends the error and stack trace to an LLM and returns
   * a one-line human-readable summary.
   */
  async summarizeError(
    errorMessage: string,
    stackTrace?: string,
  ): Promise<string | null> {
    if (!this.apiKey) {
      return null; // AI summaries disabled
    }

    try {
      const prompt = `You are analyzing a job failure in a distributed job scheduling system. 
Given the following error, provide a single-line human-readable summary (max 150 chars) 
explaining what went wrong and a likely fix. Be concise and operational.

Error: ${errorMessage}
${stackTrace ? `Stack trace (first 500 chars): ${stackTrace.substring(0, 500)}` : ''}

One-line summary:`;

      if (this.provider === 'gemini') {
        return await this.callGemini(prompt);
      }

      return null;
    } catch (error: any) {
      this.logger.debug(`AI summary failed (non-critical): ${error.message}`);
      return null;
    }
  }

  private async callGemini(prompt: string): Promise<string | null> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 100,
          temperature: 0.3,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API returned ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text?.trim() || null;
  }
}
