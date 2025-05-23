// import dotenv from 'dotenv'; // dotenv is no longer directly used here
// import path from 'path'; // path is no longer directly used here
import { getAllSubnetsForPolling } from '../lib/supabaseHelpers';
import { getMetrics } from '../services/metrics';
import { addAllMetricsSamples } from '../lib/supabaseHelpers';

// // DEBUGGING: Log the key after dotenv.config() // REMOVE THIS
// console.log(`[DEBUG Poller] SUPABASE_SERVICE_ROLE_KEY after dotenv: '${process.env.SUPABASE_SERVICE_ROLE_KEY}'`); // REMOVE THIS

const POLLING_INTERVAL_MS = 15 * 1000; // 15 seconds

let isPolling = false; // Simple lock to prevent concurrent polling runs if one takes too long

async function pollSubnetMetrics() {
  if (isPolling) {
    console.log('Polling is already in progress. Skipping this cycle.');
    return;
  }
  isPolling = true;
  console.log(`[${new Date().toISOString()}] Starting metrics polling cycle...`);

  try {
    const subnetsToPoll = await getAllSubnetsForPolling();

    if (!subnetsToPoll || subnetsToPoll.length === 0) {
      console.log('No subnets configured for polling. Sleeping for this cycle.');
      isPolling = false;
      return;
    }

    console.log(`Found ${subnetsToPoll.length} subnets to poll.`);

    for (const subnet of subnetsToPoll) {
      console.log(`Fetching metrics for subnet: ${subnet.name} (ID: ${subnet.id}, RPC: ${subnet.rpc_url})`);
      try {
        const metrics = await getMetrics(subnet.rpc_url);
        if (metrics) {
          // console.log(`Metrics for ${subnet.name}:`, JSON.stringify(metrics, null, 2)); // Detailed log if needed
          await addAllMetricsSamples(subnet.id, metrics);
          console.log(`Successfully processed and stored metrics for subnet: ${subnet.name}`);
        } else {
          console.warn(`Could not retrieve metrics for subnet: ${subnet.name}. Might be an RPC issue.`);
        }
      } catch (error) {
        console.error(`Error processing subnet ${subnet.name} (ID: ${subnet.id}):`, error instanceof Error ? error.message : error);
        // Continue to the next subnet even if one fails
      }
      // Optional: Add a small delay between processing each subnet to avoid overwhelming RPCs or DB
      // await new Promise(resolve => setTimeout(resolve, 500)); 
    }

  } catch (error) {
    console.error('Critical error during polling cycle:', error instanceof Error ? error.message : error);
    // This error would likely be from getAllSubnetsForPolling itself
  } finally {
    isPolling = false;
    console.log(`[${new Date().toISOString()}] Metrics polling cycle finished.`);
  }
}

function startPolling() {
  console.log(`AvaScope Polling Worker started. Polling interval: ${POLLING_INTERVAL_MS / 1000} seconds.`);
  
  // Initial poll immediately
  pollSubnetMetrics().catch(err => console.error('Unhandled error during initial poll:', err));

  // Then set interval for subsequent polls
  setInterval(() => {
    pollSubnetMetrics().catch(err => console.error('Unhandled error during scheduled poll:', err));
  }, POLLING_INTERVAL_MS);

  // Keep the worker alive (e.g., if running as a standalone script)
  // This might not be necessary if deployed as a background worker on a platform like Render.
  // For local testing with ts-node, it helps.
  process.stdin.resume(); 
  console.log('Polling worker is running. Press Ctrl+C to stop.');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down polling worker gracefully...');
  // Perform any cleanup if necessary
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down polling worker gracefully...');
  // Perform any cleanup if necessary
  process.exit(0);
});

// Start the poller
startPolling(); 