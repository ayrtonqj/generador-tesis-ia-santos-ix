export type ProviderType = 'openai-compatible' | 'anthropic';

export interface AIProviderDef {
  id: string;
  name: string;
  apiKeyEnv: string;
  type: ProviderType;
  baseURL?: string;
  defaultModel: string;
  models: string[];
}

export const AI_PROVIDERS: AIProviderDef[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    apiKeyEnv: 'OPENAI_API_KEY',
    type: 'openai-compatible',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini'],
  },
  {
    id: 'groq',
    name: 'Groq',
    apiKeyEnv: 'GROQ_API_KEY',
    type: 'openai-compatible',
    baseURL: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    type: 'openai-compatible',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    apiKeyEnv: 'GEMINI_API_KEY',
    type: 'openai-compatible',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    defaultModel: 'gemini-3.1-flash-lite',
    models: [
      'gemini-3.5-flash', 'gemini-3-flash', 'gemini-3.1-flash-lite',
      'gemini-2.5-flash', 'gemini-2.5-flash-lite',
    ],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    apiKeyEnv: 'MINIMAX_API_KEY',
    type: 'openai-compatible',
    baseURL: 'https://api.minimaxi.chat/v1',
    defaultModel: 'MiniMax-Text-01',
    models: ['MiniMax-Text-01', 'MiniMax-M1'],
  },
  {
    id: 'claude',
    name: 'Claude',
    apiKeyEnv: 'CLAUDE_API_KEY',
    type: 'anthropic',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: [
      'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ],
  },
];

export function getProvider(id: string): AIProviderDef | undefined {
  return AI_PROVIDERS.find(p => p.id === id);
}

export function getModelProvider(model: string): AIProviderDef | undefined {
  return AI_PROVIDERS.find(p => p.models.includes(model));
}

export function getAvailableProviders(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const p of AI_PROVIDERS) {
    const val = process.env[p.apiKeyEnv];
    result[p.id] = !!val && val !== '' && val !== 'undefined' && !val.includes('your-');
  }
  return result;
}
