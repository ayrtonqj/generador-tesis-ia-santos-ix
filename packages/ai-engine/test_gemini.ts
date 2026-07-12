import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from '@langchain/google-genai';

async function main() {
  console.log('Testing Gemini embeddings...');
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('API Key available:', !!apiKey);

  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey,
    modelName: 'text-embedding-004',
  });

  const model = new ChatGoogleGenerativeAI({
    apiKey,
    modelName: 'gemini-1.5-pro-latest',
  });

  try {
    const res = await model.invoke('Hello');
    console.log('Result:', res.content);
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}

main().catch(console.error);
