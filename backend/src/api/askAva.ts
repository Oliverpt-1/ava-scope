import express, { Request, Response, Router, NextFunction } from 'express';
import OpenAI from 'openai';

// Ensure the OpenAI API key is configured from .env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

// Placeholder function to simulate fetching context-specific data
async function getContextualData(subnetId: string, question: string): Promise<string> {
  console.log(`[AskAva API] Fetching contextual data for subnet: ${subnetId} related to question: "${question}"`);
  // Simulate different responses based on the question for placeholder purposes
  if (question.toLowerCase().includes('validator status')) {
    return `Placeholder: The validator for subnet ${subnetId} appears to be running normally. Recent uptime: 99.9%.`;
  }
  if (question.toLowerCase().includes('tps')) {
    return `Placeholder: Current TPS for subnet ${subnetId} is 45.6. The peak TPS in the last hour was 60.2.`;
  }
  if (question.toLowerCase().includes('block height')) {
    return `Placeholder: The current block height for subnet ${subnetId} is 1,234,567.`;
  }
  return `Placeholder: General information about subnet ${subnetId}. It is configured for high throughput asset transfers and supports smart contracts.`;
}

const router = Router();

router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { question, subnetId } = req.body;

  if (!question || typeof question !== 'string') {
    res.status(400).json({ error: 'Question is required and must be a string.' });
    return;
  }

  if (!subnetId || typeof subnetId !== 'string') {
    res.status(400).json({ error: 'subnetId is required and must be a string.' });
    return;
  }

  if (!process.env.OPENAI_KEY) {
    console.error('[AskAva API] OPENAI_KEY is not configured in .env.');
    res.status(500).json({ error: 'AI service is not configured. Administrator has been notified.' });
    return;
  }

  try {
    const contextualInfo = await getContextualData(subnetId, question);

    const systemPrompt = `You are Ava, an expert AI assistant for the AvaScope platform.
Your role is to help users understand and manage their blockchain subnets using the AvaScope tool.
You have access to specific information about the user's current subnet, which is Subnet ID: ${subnetId}.
Always be concise, helpful, and use the provided contextual information to answer questions accurately.
If the question is unrelated to blockchain technology, subnets, validators, transactions, smart contracts, or the AvaScope platform, politely state that you can only answer questions about those topics.
Do not invent information if it's not in the provided context. If the context doesn't cover the question, state that you don't have that specific information for subnet ${subnetId} at the moment.

Contextual Information for subnet ${subnetId}:
${contextualInfo}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', 
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      temperature: 0.6, // Slightly lower for more factual responses
      max_tokens: 300,  
    });

    const answer = completion.choices[0]?.message?.content?.trim();

    if (answer) {
      res.status(200).json({ answer });
    } else {
      console.error('[AskAva API] No answer received from OpenAI.');
      res.status(500).json({ error: 'Failed to get a response from the AI assistant.' });
    }
  } catch (error: any) {
    console.error('[AskAva API] Error during OpenAI API call:', error.message);
    if (error.response) {
      console.error('OpenAI API Error Status:', error.response.status);
      console.error('OpenAI API Error Data:', error.response.data);
      res.status(error.response.status || 500).json({ error: 'Error from AI service.', details: error.response.data?.error?.message || 'An unknown error occurred with the AI provider.' });
    } else {
      res.status(500).json({ error: 'An unexpected error occurred while contacting the AI assistant.', details: error.message });
    }
    // If you had a centralized error handler, you might call next(error) here.
  }
});

export default router; 