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
  
  // Try cloud first if available
  if (mode === 'cloud' || mode === 'hybrid') {
    try {
      yield* queryCloudOnly(prompt, userContext);
      return;
    } catch (error) {
      console.warn('☁️ Cloud LLM failed, trying local...', error);
      if (mode === 'cloud') {
        throw error; // Don't fallback if cloud-only mode
      }
    }
  }
  
  // Fallback to local
  yield* queryLocalOnly(prompt, userContext);
}

/**
 * Query cloud LLM only
 */
async function* queryCloudOnly(prompt: string, userContext?: any): AsyncGenerator<string> {
  const apiKey = process.env.EXPO_PUBLIC_CLOUD_LLM_API_KEY;
  const provider = (process.env.EXPO_PUBLIC_CLOUD_LLM_PROVIDER || 'groq') as any;
  
  if (!apiKey) {
    throw new Error('Cloud LLM API key not configured');
  }
  
  // Build simple, focused system prompt
  let systemPrompt = `You are KrushiAI, a helpful farming assistant. 
Answer in simple Hindi (Devanagari script). Keep answers short (2-3 sentences max).
Be direct and practical and  Always start by addressing the user by name`;
  
  // Add only essential user info
  if (userContext?.user_data) {
    const userName = userContext.user_data.user_name || 'किसान';
    const location = userContext.user_data.user_location?.address;
    
    systemPrompt += `\n\nUser: ${userName}`;
    if (location) {
      systemPrompt += `\nLocation: ${location}`;
    }
  }
  
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ];
  
  const config: CloudLLMConfig = {
    provider,
    apiKey,
    model: process.env.EXPO_PUBLIC_CLOUD_LLM_MODEL || 
           (provider === 'groq' ? 'llama3-8b-8192' : 'meta-llama/llama-3-8b-instruct')
  };
  
  yield* queryCloudLLMStream(messages, config);
}

/**
 * Query local Ollama only
 */
async function* queryLocalOnly(prompt: string, userContext?: any): AsyncGenerator<string> {
  // Build simple, clear prompt
  let fullPrompt = `You are KrushiAI, a farming assistant. Answer in simple Hindi (Devanagari script). Keep it short and practical and Always start by addressing the user by name`;
  
  // Add only essential context
  if (userContext?.user_data) {
    const userName = userContext.user_data.user_name || 'किसान';
    const location = userContext.user_data.user_location?.address;
    
    fullPrompt += `\n\nUser: ${userName}`;
    if (location) {
      fullPrompt += `\nLocation: ${location}`;
    }
  }
  
  fullPrompt += `\n\nQuestion: ${prompt}\n\nAnswer:`;
  
  console.log('📝 Simplified Prompt:', fullPrompt.substring(0, 200) + '...');
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
