import express, { Request, Response, Router, NextFunction } from 'express';
import OpenAI from 'openai';
import {
  getAvaContextLatestTps,
  getAvaContextLatestBlockInfo,
  getAvaContext24hErc20TransferTotal,
  getAvaContextCurrentGasLoad,
  // You might also want a helper to get basic subnet details like its name, if not already available
  // getSubnetDetails, // Assuming you might have/want this
} from '../lib/supabaseHelpers'; // Adjust path if your helpers are elsewhere

// Ensure the OpenAI API key is configured from .env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

async function getContextualData(subnetId: string, question: string): Promise<string> {
  console.log(`[AskAva API] Fetching REAL contextual data for subnet: ${subnetId} related to question: "${question}"`);
  let contextParts: string[] = [];

  try {
    // Fetch all context data concurrently
    const [tpsData, blockInfo, ercData, gasLoadData /*, subnetDetails */] = await Promise.all([
      getAvaContextLatestTps(subnetId),
      getAvaContextLatestBlockInfo(subnetId),
      getAvaContext24hErc20TransferTotal(subnetId),
      getAvaContextCurrentGasLoad(subnetId),
      // getSubnetDetails(subnetId), // Example if you fetch subnet name/type too
    ]);

    // Subnet Name (Example - if you fetch it)
    // if (subnetDetails && subnetDetails.name) {
    //   contextParts.push(`- Subnet Name: ${subnetDetails.name}`);
    // }

    // Transaction Throughput
    if (tpsData && tpsData.currentTps !== null) {
      contextParts.push(`- Current Transaction Throughput (TPS): ${tpsData.currentTps}`);
    } else {
      contextParts.push("- Current Transaction Throughput (TPS): Data not available");
    }

    // Latest Block Info
    if (blockInfo) {
      contextParts.push(`- Latest Block Number: ${blockInfo.block_number || 'N/A'}`);
      if (blockInfo.block_timestamp) {
        contextParts.push(`  - Timestamp: ${new Date(blockInfo.block_timestamp).toLocaleString()}`)
      }
      if (blockInfo.block_time_seconds !== null) {
        contextParts.push(`  - Avg Block Time (around this block): ${Number(blockInfo.block_time_seconds).toFixed(2)}s`);
      }
      if (blockInfo.transaction_count !== null) {
        contextParts.push(`  - Transactions in Block: ${blockInfo.transaction_count}`);
      }
      if (blockInfo.gas_used !== null) {
        contextParts.push(`  - Gas Used in Block: ${blockInfo.gas_used.toLocaleString()}`);
      }
      if (blockInfo.block_size_bytes !== null) {
        contextParts.push(`  - Block Size: ${(blockInfo.block_size_bytes / 1024).toFixed(2)} KB`);
      }
    } else {
      contextParts.push("- Latest Block Info: Data not available");
    }

    // ERC20 Transfers (24h)
    if (ercData && ercData.totalTransfers !== null) {
      contextParts.push(`- ERC20 Transfers (last 24h): ${ercData.totalTransfers.toLocaleString()}`);
    } else {
      contextParts.push("- ERC20 Transfers (last 24h): Data not available");
    }

    // Gas Load
    if (gasLoadData && gasLoadData.currentLoadPercent !== null) {
      contextParts.push(`- Current Gas Load: ${gasLoadData.currentLoadPercent}%`);
    } else {
      contextParts.push("- Current Gas Load: Data not available");
    }

  } catch (error: any) {
    console.error(`[AskAva API] Error fetching some contextual data for subnet ${subnetId}:`, error.message);
    contextParts.push("Note: There was an issue fetching some live data details for the subnet.");
  }
  
  if (contextParts.length === 0) {
    return "No specific dashboard data could be fetched for this subnet at the moment.";
  }

  return "Current Subnet Dashboard Overview:\n" + contextParts.join("\n");
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