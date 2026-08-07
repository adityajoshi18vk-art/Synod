import { callLLM } from './api/_lib/llmClient.js';
import 'dotenv/config';

async function main() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('No GROQ_API_KEY found');
  
  try {
    const res = await callLLM({
      baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey,
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Say hello in json format {"hello": "world"}' }]
    });
    console.log('SUCCESS:', res);
  } catch (err) {
    console.error('ERROR:', err.message);
  }
}

main();
