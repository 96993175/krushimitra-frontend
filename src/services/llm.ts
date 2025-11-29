/**
 * Unified LLM Service with Cloud + Local Hybrid Support
 * Automatically uses cloud when available, falls back to local
 */

import { queryOllamaStream } from '../utils/ollama';
import { queryCloudLLMStream, type CloudLLMConfig } from './cloudLLM';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}


export type LLMMode = 'cloud' | 'local' | 'hybrid';

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
  const mode = process.env.EXPO_PUBLIC_LLM_MODE || 'hybrid';
  return mode as LLMMode;
}

/**
 * Query LLM with automatic provider selection and failover
 */
export async function* queryLLMStream(
  prompt: string,
  _conversationHistory?: ChatMessage[],
  userContext?: any
): AsyncGenerator<string> {
  const mode = getLLMMode();
  console.log('🤖 LLM Mode:', mode);
  console.log('📋 User Context:', userContext ? 'Included' : 'Not provided');
  
  // Hybrid mode: Try local first, then cloud
  if (mode === 'hybrid') {
    try {
      console.log('🔄 Trying local Ollama first...');
      yield* queryLocalOnly(prompt, userContext);
      return;
    } catch (error) {
      console.warn('⚠️ Local Ollama failed, trying cloud fallback...', error);
      try {
        yield* queryCloudOnly(prompt, userContext);
        return;
      } catch (cloudError) {
        console.error('❌ Both local and cloud failed');
        throw new Error('Both local and cloud LLM failed. Please check your configuration.');
      }
    }
  }
  
  // Cloud-only mode
  if (mode === 'cloud') {
    try {
      yield* queryCloudOnly(prompt, userContext);
      return;
    } catch (error) {
      console.error('☁️ Cloud LLM failed:', error);
      throw error;
    }
  }
  
  // Local-only mode
  yield* queryLocalOnly(prompt, userContext);
}

/**
 * Query cloud LLM only
 */
async function* queryCloudOnly(prompt: string, userContext?: any): AsyncGenerator<string> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY || process.env.EXPO_PUBLIC_CLOUD_LLM_API_KEY;
  const provider = (process.env.EXPO_PUBLIC_CLOUD_LLM_PROVIDER || 'groq') as any;
  
  if (!apiKey) {
    throw new Error('Cloud LLM API key not configured. Set EXPO_PUBLIC_GROQ_API_KEY in .env');
  }
  
  console.log(`☁️ Using cloud LLM: ${provider}`);
  
  // Only extract user name from context (no fallback to generic term)
  const userName = userContext?.user_data?.user_name || 'User';
  
  // Build simplified prompt with only user name
  const systemPrompt = `You are KrushiAI, a simple farming assistant.
Reply only in easy Hindi (Devanagari) and always take username in answer
User name = ${userName}

Answer the user's question in a helpful and friendly manner.`;
  
  const userMessage = `--- USER QUESTION ---
${prompt}
-----------------------

Your Answer (in Hindi):`;
  
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];
  
  const config: CloudLLMConfig = {
    provider,
    apiKey,
    model: process.env.EXPO_PUBLIC_CLOUD_LLM_MODEL || 
           (provider === 'groq' ? 'llama-3.1-8b-instant' : 'meta-llama/llama-3-8b-instruct')
  };
  
  console.log('📤 Sending to cloud LLM:', {
    provider: config.provider,
    model: config.model,
    hasApiKey: !!config.apiKey,
    apiKeyPrefix: config.apiKey?.substring(0, 4),
    userName: userName
  });
  
  // Log the actual prompt being sent
  console.log('🔍 System Prompt:', systemPrompt);
  console.log('🔍 User Message:', userMessage.substring(0, 100) + '...');
  
  yield* queryCloudLLMStream(messages, config);
}

/**
 * Query local Ollama only
 */
async function* queryLocalOnly(prompt: string, userContext?: any): AsyncGenerator<string> {
  // Only extract user name from context (no fallback to generic term)
  const userName = userContext?.user_data?.user_name || 'User';
  
  // Build simplified prompt with only user name
  const fullPrompt = `You are KrushiAI, a simple farming assistant.
Reply only in easy Hindi (Devanagari) and always take users name i answer
User name = ${userName}

Answer the user's question in a helpful and friendly manner.

--- USER QUESTION ---
${prompt}
-----------------------

Your Answer (in Hindi):`;
  
  console.log('📝 Formatted Prompt for user:', userName);
  console.log('🔍 Full Prompt:', fullPrompt.substring(0, 200) + '...');
  yield* queryOllamaStream(fullPrompt);
}

/**
 * Query LLM (non-streaming) with automatic failover
 */
export async function queryLLM(prompt: string): Promise<LLMResponse> {
  let fullResponse = '';
  const mode = getLLMMode();
  
  try {
    for await (const chunk of queryLLMStream(prompt)) {
      fullResponse += chunk;
    }
    return {
      text: fullResponse,
      provider: mode === 'local' ? 'local' : 'cloud',
      model: mode === 'local' ? 'llama3.2:1b' : 'llama3-8b'
    };
  } catch (error) {
    console.error('LLM error:', error);
    return {
      text: '',
      provider: mode === 'local' ? 'local' : 'cloud',
      model: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
