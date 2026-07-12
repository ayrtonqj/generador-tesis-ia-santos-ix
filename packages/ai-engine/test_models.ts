import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

const MODELS_TO_TRY = [
  'gemini-pro',
  'gemini-1.0-pro',
  'gemini-1.5-pro',
  'gemini-1.5-pro-latest',
  'gemini-1.5-pro-002',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.5-pro-preview-05-06',
];

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('API Key available:', !!apiKey);

  for (const modelName of MODELS_TO_TRY) {
    try {
      const model = new ChatGoogleGenerativeAI({ apiKey, modelName, maxOutputTokens: 10 });
      const res = await model.invoke('Say OK');
      console.log(`✅ ${modelName}: ${JSON.stringify(res.content).substring(0, 60)}`);
    } catch (e: any) {
      const msg = e.message?.substring(0, 80) || 'unknown error';
      console.log(`❌ ${modelName}: ${msg}`);
    }
  }
}

main().catch(console.error);
