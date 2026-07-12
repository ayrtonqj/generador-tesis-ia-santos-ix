import { GoogleGenerativeAI } from '@google/generative-ai';

const MODELS_TO_TRY = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite-preview-02-05',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
  'gemini-1.5-pro-latest'
];

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('NO API KEY');
  const client = new GoogleGenerativeAI(apiKey);

  for (const modelName of MODELS_TO_TRY) {
    try {
      const model = client.getGenerativeModel({ model: modelName });
      const res = await model.generateContent('Say OK');
      console.log(`✅ ${modelName}: OK`);
    } catch (e: any) {
      console.log(`❌ ${modelName}: ${e.message?.substring(0, 80)}`);
    }
  }
}

main().catch(console.error);
