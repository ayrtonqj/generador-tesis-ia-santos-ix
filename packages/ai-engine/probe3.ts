import { GoogleGenerativeAI } from '@google/generative-ai';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  const client = new GoogleGenerativeAI(apiKey!);
  try {
    const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
    await model.generateContent('Say OK');
  } catch (e: any) {
    console.log(e.message);
  }
}

main().catch(console.error);
