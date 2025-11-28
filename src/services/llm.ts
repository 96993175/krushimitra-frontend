/**
 * Unified LLM Service with Cloud + Local Hybrid Support
 * Automatically uses cloud when available, falls back to local
 */

import { queryOllamaStream } from '../utils/ollama';
// Cloud imports removed – enforcing local-only mode

// Local-only design: we keep a minimal ChatMessage type for compatibility
// with existing call signatures, but ignore it internally.
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type LLMMode = 'local'; // Cloud & hybrid disabled

export interface LLMResponse {
  text: string;
  provider: 'cloud' | 'local';
  model: string;
  error?: string;
}

/**
 * Get current LLM mode from environment
 */
function getLLMMode(): LLMMode {
  // Force local-only regardless of environment configuration.
  return 'local';
}

/**
 * Query LLM with automatic provider selection and failover
 */
export async function* queryLLMStream(
  prompt: string,
  _conversationHistory?: ChatMessage[],
  userContext?: any
): AsyncGenerator<string> {
  // Local-only streaming; no cloud logic executed.
  console.log('🤖 LLM Mode: local (cloud disabled)');
  console.log('📋 User Context:', userContext ? 'Included' : 'Not provided');
  yield* queryLocalOnly(prompt, userContext);
}

/**
 * Query cloud LLM only
 */
// Cloud querying removed – intentionally disabled for strict local usage.

/**
 * Query local Ollama only
 */
async function* queryLocalOnly(prompt: string, userContext?: any): AsyncGenerator<string> {
  // Build context-aware prompt with clear instructions
  let fullPrompt = `You are KrushiAI — a smart and trusted farming helper. Give short, simple. always start answer by taking name of that user at first`;
  
  // Add user context if available
  if (userContext) {
    fullPrompt += '\n\n=== USER CONTEXT (Use this to answer questions about the user) ===\n';
    if (userContext.user_data) {
      fullPrompt += `User Name: ${userContext.user_data.user_name || 'Unknown'}\n`;
      fullPrompt += `Phone: ${userContext.user_data.user_phone || 'Not provided'}\n`;
      fullPrompt += `Language: ${userContext.user_data.user_language || 'hi'}\n`;
      if (userContext.user_data.user_location) {
        fullPrompt += `Location: ${userContext.user_data.user_location.address}\n`;
      }
      if (userContext.user_data.user_weather) {
        fullPrompt += `Current Weather: ${userContext.user_data.user_weather.condition}, ${userContext.user_data.user_weather.temperature}°C\n`;
      }
    }
    
    // Add conversation history
    if (userContext.last_5_conversations && userContext.last_5_conversations.length > 0) {
      fullPrompt += '\n=== RECENT CONVERSATIONS ===\n';
      userContext.last_5_conversations.forEach((conv: any, idx: number) => {
        fullPrompt += `${idx + 1}. [${conv.role}]: ${conv.message}\n`;
      });
    }
  }
  
  fullPrompt += `\n=== USER QUESTION ===\n${prompt}\n\n=== YOUR ANSWER (in Hindi) ===\n`;
  
  console.log('📝 Full LLM Prompt:', fullPrompt.substring(0, 300) + '...');
  yield* queryOllamaStream(fullPrompt);
}

/**
 * Query LLM (non-streaming) with automatic failover
 */
export async function queryLLM(prompt: string): Promise<LLMResponse> {
  let fullResponse = '';
  try {
    for await (const chunk of queryLLMStream(prompt)) {
      fullResponse += chunk;
    }
    return {
      text: fullResponse,
      provider: 'local',
      model: 'llama3.2:1b'
    };
  } catch (error) {
    console.error('Local LLM error (cloud disabled):', error);
    return {
      text: '',
      provider: 'local',
      model: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
