import express, { Request, Response, Router, NextFunction } from 'express';
import OpenAI from 'openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Ensure the OpenAI API key is configured from .env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

interface HourlyTransferData {
  hour: string;
  transfers: number;
}

async function fetchHourlyErc20Data(db: SupabaseClient, subnetId: string): Promise<HourlyTransferData[] | null> {
  // 1. Get the most recent record's timestamp
  const { data: latestRecord, error: latestRecordError } = await db
    .from('erc_transfer_counts')
    .select('block_timestamp')
    .eq('subnet_id', subnetId)
    .order('block_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestRecordError) {
    console.error(`[AvaContext] Error fetching latest ERC20 record for hourly data for ${subnetId}:`, latestRecordError.message);
    return null;
  }

  if (!latestRecord || !latestRecord.block_timestamp) {
    return []; // No data to process, return empty array to signify no error but no data
  }

  const latestDataTimestamp = new Date(latestRecord.block_timestamp);
  const endWindow = latestDataTimestamp;
  const startWindow = new Date(endWindow.getTime() - 24 * 60 * 60 * 1000);

  // 2. Fetch records in the 24-hour window
  const { data: records, error: recordsError } = await db
    .from('erc_transfer_counts')
    .select('block_timestamp, erc20_transfers')
    .eq('subnet_id', subnetId)
    .gte('block_timestamp', startWindow.toISOString())
    .lte('block_timestamp', endWindow.toISOString())
    .order('block_timestamp', { ascending: true });

  if (recordsError) {
    console.error(`[AvaContext] Error fetching ERC20 records for hourly data for ${subnetId}:`, recordsError.message);
    return null;
  }

  if (!records || records.length === 0) {
    return [];
  }

  // 3. Aggregate by hour
  const hourlyTotals: { [key: string]: number } = {};
  records.forEach(record => {
    if (record.block_timestamp && typeof record.erc20_transfers === 'number') {
      const recordTimestamp = new Date(record.block_timestamp);
      const hourKey = new Date(
        recordTimestamp.getFullYear(),
        recordTimestamp.getMonth(),
        recordTimestamp.getDate(),
        recordTimestamp.getHours(),
        0, 0, 0 
      ).toISOString();

      hourlyTotals[hourKey] = (hourlyTotals[hourKey] || 0) + record.erc20_transfers;
    }
  });

  const result: HourlyTransferData[] = Object.entries(hourlyTotals)
    .map(([hour, transfers]) => ({ hour, transfers }))
    .sort((a, b) => new Date(a.hour).getTime() - new Date(b.hour).getTime());

  return result;
}

async function getContextualData(db: SupabaseClient, subnetId: string, question: string): Promise<string> {
  console.log(`[AskAva API] Fetching REAL contextual data for subnet: ${subnetId} related to question: "${question}"`);
  let contextParts: string[] = [];

  try {
    // Helper queries that run with the provided, authed client -----------------

    const fetchLatestTps = async () => {
      // Fetch the last 100 TPS samples for the subnet and take the average.
      const { data, error } = await db
        .from('tps_samples')
        .select('tps_value')
        .eq('subnet_id', subnetId)
        .order('sampled_at', { ascending: false })
        .limit(100);

      if (error && error.code !== 'PGRST116') {
        console.error(`[AvaContext] Error fetching TPS samples for ${subnetId}:`, error.message);
        return { currentTps: null };
      }

      if (!data || data.length === 0) {
        console.log(`[AvaContext] No TPS samples found for subnet ${subnetId}.`);
        return { currentTps: null };
      }

      // Convert values to numbers and filter out invalid or null entries
      const numericValues = data
        .map((row) => Number(row.tps_value))
        .filter((val) => !isNaN(val));

      if (numericValues.length === 0) {
        console.log(`[AvaContext] All fetched TPS values were NaN for subnet ${subnetId}.`);
        return { currentTps: null };
      }

      const sum = numericValues.reduce((acc, val) => acc + val, 0);
      const avg = sum / numericValues.length;

      const avgFixed = parseFloat(avg.toFixed(3));
      console.log(`[AvaContext DEBUG TPS] Subnet ${subnetId} - Average of last ${numericValues.length} samples: ${avgFixed}`);

      return { currentTps: avgFixed };
    };

    const fetchLatestBlockInfo = async () => {
      const { data, error } = await db
        .from('blocktime_samples')
        .select('block_number, block_timestamp, block_time_seconds, transaction_count, gas_used, block_size_bytes')
        .eq('subnet_id', subnetId)
        .order('block_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error(`[AvaContext] Error fetching latest block info for ${subnetId}:`, error.message);
        return null;
      }
      return data || null;
    };

    const fetchCurrentGasLoad = async () => {
      const { data, error } = await db
        .from('gas_utilization_samples')
        .select('utilization_percentage')
        .eq('subnet_id', subnetId)
        .order('block_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error(`[AvaContext] Error fetching current gas load for ${subnetId}:`, error.message);
        return { currentLoadPercent: null };
      }
      return { currentLoadPercent: data ? data.utilization_percentage : null };
    };

    // Run all queries concurrently
    const [tpsData, blockInfo, gasLoadData, hourlyErc20TrendData] = await Promise.all([
      fetchLatestTps(),
      fetchLatestBlockInfo(),
      fetchCurrentGasLoad(),
      fetchHourlyErc20Data(db, subnetId),
    ]);

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

    // Hourly ERC20 Transfers
    if (hourlyErc20TrendData && hourlyErc20TrendData.length > 0) {
      contextParts.push("- Hourly ERC20 Transfers (up to 24h from latest data point):");
      hourlyErc20TrendData.forEach(item => {
        // Format hour for better readability if needed, e.g., using toLocaleString()
        const displayHour = new Date(item.hour).toLocaleString(); 
        contextParts.push(`  - ${displayHour}: ${item.transfers} transfers`);
      });
    } else if (hourlyErc20TrendData === null) { // Indicates an error during fetch
      contextParts.push("- Hourly ERC20 Transfers: Error fetching data.");
    } else { // Empty array, implies no data found for the window but no error
      contextParts.push("- Hourly ERC20 Transfers: No transfer data available in the last 24h from the latest data point.");
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
  const authHeader = req.headers["authorization"] as string | undefined;
  const token = authHeader?.replace(/^Bearer\s+/i, "");

  if (!token) {
    res.status(401).json({ error: "Authorization token missing from request." });
    return;
  }

  // Build a Supabase client that *reuses* the caller's JWT so that all queries
  // in this request run in the same RLS context as the frontend.
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[AskAva API] SUPABASE_URL or SUPABASE_KEY missing from env.");
    res.status(500).json({ error: "Server configuration error: Supabase credentials missing." });
    return;
  }

  const db = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // ---------------------------------------------------------------------
  // Ensure the caller is allowed to access the requested subnet. Because
  // the Supabase client is instantiated with the user's JWT, this check is
  // automatically enforced by RLS policies. We perform an explicit query so
  // that we can bail out early with a helpful message instead of returning
  // empty data later in the pipeline.
  // ---------------------------------------------------------------------
  const { data: subnetRow, error: subnetLookupError } = await db
    .from('subnets')
    .select('id')
    .eq('id', subnetId)
    .maybeSingle();

  if (subnetLookupError) {
    console.error(`[AskAva API] Subnet lookup error for ${subnetId}:`, subnetLookupError.message);
    res.status(500).json({ error: 'Failed to verify subnet access.', details: subnetLookupError.message });
    return;
  }

  if (!subnetRow) {
    res.status(403).json({ error: 'You do not have access to the requested subnet or it does not exist.' });
    return;
  }

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
    const contextualInfo = await getContextualData(db, subnetId, question);

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