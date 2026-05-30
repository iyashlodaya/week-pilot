// ─────────────────────────────────────────────────────────────
// WeekPilot — AI Summarizer Agent
// ─────────────────────────────────────────────────────────────

import * as crypto from 'node:crypto';
import OpenAI from 'openai';
import type {
  CollectedData,
  GeneratedSummary,
  SummarySections,
  WeekPilotConfig,
} from '../types.js';
import { today, weekNumber } from '../utils/dates.js';
import { retry } from '../utils/retry.js';
import { logger } from '../utils/logger.js';
import {
  dailySystemPrompt,
  dailyUserPrompt,
  weeklySystemPrompt,
  weeklyUserPrompt,
} from '../prompts/index.js';

/**
 * AI Summarizer agent that generates standup updates and weekly summaries.
 *
 * Supports multiple LLM providers (OpenAI, Gemini) controlled by config.
 * The active provider is selected via the LLM_PROVIDER env var / config field.
 */
export class Summarizer {
  private config: WeekPilotConfig;

  // OpenAI client — lazily initialised only when provider is 'openai'
  private openaiClient: OpenAI | null = null;

  constructor(config: WeekPilotConfig) {
    this.config = config;

    if (config.llmProvider === 'openai') {
      this.openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
    }
  }

  /**
   * Generate a daily standup update from collected data.
   */
  async generateDaily(data: CollectedData): Promise<GeneratedSummary> {
    logger.info(`Generating daily standup update via ${this.config.llmProvider}...`);

    const systemPrompt = dailySystemPrompt();
    const userPrompt = dailyUserPrompt(data);

    const raw = await this.callLLM(systemPrompt, userPrompt);
    const sections = parseSections(raw);
    const content = formatContent(raw);

    return {
      id: generateId('daily', data.dateRange.from),
      type: 'daily',
      date: data.dateRange.from,
      content,
      sections,
      raw,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generate a weekly summary from collected data.
   */
  async generateWeekly(data: CollectedData): Promise<GeneratedSummary> {
    logger.info(`Generating weekly summary via ${this.config.llmProvider}...`);

    const systemPrompt = weeklySystemPrompt();
    const userPrompt = weeklyUserPrompt(data);

    const raw = await this.callLLM(systemPrompt, userPrompt);
    const sections = parseSections(raw);
    const content = formatContent(raw);

    const week = weekNumber(new Date(data.dateRange.from + 'T00:00:00'));

    return {
      id: generateId('weekly', week),
      type: 'weekly',
      date: week,
      content,
      sections,
      raw,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Make the actual LLM API call with retry logic.
   * Delegates to the provider-specific implementation.
   */
  private async callLLM(
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    // Check if the input is too large and truncate if needed
    const maxInputChars = 12000; // rough limit to stay within token budget
    let truncatedUserPrompt = userPrompt;
    if (userPrompt.length > maxInputChars) {
      truncatedUserPrompt = userPrompt.slice(0, maxInputChars) + '\n\n[... truncated]';
      logger.warn(
        `Input truncated from ${userPrompt.length} to ${maxInputChars} characters`
      );
    }

    if (this.config.llmProvider === 'gemini') {
      return this.callGemini(systemPrompt, truncatedUserPrompt);
    }

    return this.callOpenAI(systemPrompt, truncatedUserPrompt);
  }

  // ── OpenAI ───────────────────────────────────────────────

  private async callOpenAI(
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    const client = this.openaiClient!;
    const model = this.config.openaiModel;

    const response = await retry(
      async () => {
        const completion = await client.chat.completions.create({
          model,
          messages: [
            { role: 'developer', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3, // low temperature for consistent, factual output
          max_tokens: 1500,
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from OpenAI');
        }
        return content;
      },
      { maxAttempts: 3, label: 'OpenAI API call' }
    );

    return response;
  }

  // ── Gemini (REST API) ────────────────────────────────────

  private async callGemini(
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    const model = this.config.geminiModel;
    const apiKey = this.config.geminiApiKey;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const body = {
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1500,
      },
    };

    const response = await retry(
      async () => {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`Gemini API error ${res.status}: ${errBody}`);
        }

        const json = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };

        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error('Empty response from Gemini');
        }
        return text;
      },
      { maxAttempts: 3, label: 'Gemini API call' }
    );

    return response;
  }
}

/**
 * Parse structured sections from the LLM response text.
 * Extracts bullet points under known headers.
 */
function parseSections(raw: string): SummarySections {
  const sections: SummarySections = {
    accomplishments: [],
    blockers: [],
    nextSteps: [],
  };

  const lines = raw.split('\n');
  let currentSection: keyof SummarySections | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();

    // Detect section headers
    if (lower.includes('accomplishment') || lower.includes('key accomplishment') || lower.includes('weekly summary')) {
      currentSection = 'accomplishments';
      continue;
    }
    if (lower.includes('blocker') || lower.includes('challenge')) {
      currentSection = 'blockers';
      continue;
    }
    if (lower.includes('next step') || lower.includes('next week') || lower.includes('focus')) {
      currentSection = 'nextSteps';
      continue;
    }

    // Collect bullet points
    if (currentSection && trimmed.startsWith('-')) {
      const item = trimmed.slice(1).trim();
      if (item && item.toLowerCase() !== 'none' && item.toLowerCase() !== 'none.') {
        sections[currentSection].push(item);
      }
    }
  }

  return sections;
}

/**
 * Clean up the raw LLM response for display.
 */
function formatContent(raw: string): string {
  return raw.trim();
}

/**
 * Generate a deterministic ID for a summary.
 */
function generateId(type: string, dateKey: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${type}-${dateKey}-${today()}`)
    .digest('hex')
    .slice(0, 12);
  return `${type}-${hash}`;
}

// TODO(phase-2): Add agent reflection step — rate own output quality
// TODO(phase-2): Add streaming output for longer summaries
// TODO(phase-2): Add context window from previous summaries for continuity
// TODO(phase-2): Support multiple summary styles (manager-friendly, technical)
