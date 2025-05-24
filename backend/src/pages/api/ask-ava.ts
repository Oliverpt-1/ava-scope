import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

// Ensure the OpenAI API key is configured
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

// Placeholder function to simulate fetching context-specific data
// In a real application, this would fetch relevant data from Supabase based on subnetId
async function getContextualData(subnetId: string, question: string): Promise<string> {
  // Simulate fetching data related to the subnet and question
  // This could involve looking up subnet details, recent activity, common issues, etc.
  console.log(`[AskAva API] Fetching contextual data for subnet: ${subnetId} related to question: "${question}"`);
  
  // Example: You might fetch recent errors, performance metrics, or documentation snippets
  // For now, returning a placeholder string
  if (question.toLowerCase().includes('validator status')) {
    return "Placeholder: The validator for subnet " + subnetId + " appears to be running normally. Recent uptime: 99.9%.";
  }
  if (question.toLowerCase().includes('tps')) {
    return "Placeholder: Current TPS for subnet " + subnetId + " is 45.6. The peak TPS in the last hour was 60.2.";
  }
  return "Placeholder: General information about subnet " + subnetId + ". It is configured for high throughput asset transfers.";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { question, subnetId } = req.body;

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Question is required and must be a string.' });
  }

  if (!subnetId || typeof subnetId !== 'string') {
    return res.status(400).json({ error: 'subnetId is required and must be a string.' });
  }
  
  if (!process.env.OPENAI_KEY) {
    console.error('[AskAva API] OPENAI_KEY is not configured.');
    return res.status(500).json({ error: 'AI service is not configured.' });
  }

  try {
    const contextualInfo = await getContextualData(subnetId, question);

    const systemPrompt = `You are Ava, an expert AI assistant for the AvaScope platform.
Your role is to help users understand and manage their blockchain subnets.
You have access to specific information about the user's current subnet.
Be concise, helpful, and use the provided context to answer questions.
If the question is unrelated to blockchain, subnets, validators, or the AvaScope platform, politely decline to answer.
Contextual Information for subnet ${subnetId}:
${contextualInfo}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Or a newer model if preferred
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      temperature: 0.7, // Adjust for creativity vs. factuality
      max_tokens: 250,  // Adjust as needed
    });

    const answer = completion.choices[0]?.message?.content?.trim();

    if (answer) {
      res.status(200).json({ answer });
    } else {
      console.error('[AskAva API] No answer received from OpenAI.');
      res.status(500).json({ error: 'Failed to get a response from the AI assistant.' });
    }
  } catch (error: any) {
    console.error('[AskAva API] Error during OpenAI API call:', error);
    if (error.response) {
      // OpenAI API error
      console.error('OpenAI API Error Details:', error.response.data);
      return res.status(error.response.status || 500).json({ error: 'Error from AI service.', details: error.response.data });
    }
    res.status(500).json({ error: 'An unexpected error occurred.', details: error.message });
  }
} 