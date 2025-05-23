import { Router, Request, Response } from 'express';
import { asyncHandler } from './asyncHandler'; // Assuming asyncHandler is in the same directory: src/api/
import { 
  getTpsSamples, 
  getBlocktimeSamples,
  getAverageBlockTime,
  getAverageTps,
  getErc20TransferCounts,
  getErc721TransferCounts,
  getGasUtilizationSamples,
  getSubnetRpcUrl
} from '../lib/supabaseHelpers'; // Corrected path to lib/
import { getMetrics as getLiveSubnetMetrics } from '../services/metrics'; // For live metrics

const router = Router();

const DEFAULT_RANGE_HOURS = 24;
const DEFAULT_GAS_SAMPLES_LIMIT = 100; // For gas utilization histogram (e.g., last 100 blocks)

// GET /api/metrics/:subnetId/live - Fetch live metrics for a subnet
router.get('/:subnetId/live', asyncHandler(async (req: Request, res: Response) => {
  const { subnetId } = req.params;
  const rpcUrl = await getSubnetRpcUrl(subnetId);

  if (!rpcUrl) {
    return res.status(404).json({ error: 'Subnet not found or RPC URL not configured.' });
  }

  try {
    // TODO: Add validation that the user making the request has access to this subnetId
    // This is partially handled by getSubnetRpcUrl if it uses the user-context supabase client.
    console.log(`Fetching LIVE metrics for subnet ${subnetId}`);
    const liveMetrics = await getLiveSubnetMetrics(rpcUrl);
    
    // The liveMetrics object from getLiveSubnetMetrics now provides:
    // - tps (calculated from latest 2 blocks)
    // - blockProduction (latestBlock, lastBlockTimeSeconds, txCount, blockSize, gasUsed, gasLimit)
    // - avgGasUtilizationPercent (for the LATEST block only)
    // It has placeholders for erc20/erc721 counts because those are from aggregated stored data.
    // We might want to fetch the latest aggregated counts here too to make 'live' more complete.
    // For now, returning what getLiveSubnetMetrics provides plus latest aggregated transfer counts.

    // Fetch latest 1-minute aggregated transfer counts as a "live" view
    const latestErc20 = await getErc20TransferCounts(subnetId, 0.02); // Approx last minute or so
    const latestErc721 = await getErc721TransferCounts(subnetId, 0.02);

    res.json({
      ...liveMetrics,
      // Override placeholders with latest fetched aggregates if available
      erc20TransferCountsPerMinute: latestErc20.length > 0 ? latestErc20[latestErc20.length-1].transfer_count : 0,
      erc721TransferCountsPerMinute: latestErc721.length > 0 ? latestErc721[latestErc721.length-1].transfer_count : 0,
    });

  } catch (error) {
    console.error(`Error fetching live metrics for subnet ${subnetId} (RPC: ${rpcUrl}):`, error);
    res.status(500).json({ error: 'Failed to fetch live metrics.' });
  }
}));

// GET /api/metrics/:subnetId/tps - Fetch stored TPS samples for a given subnet
router.get('/:subnetId/tps', asyncHandler(async (req: Request, res: Response) => {
  const { subnetId } = req.params;
  const rangeHours = req.query.rangeHours ? parseInt(req.query.rangeHours as string, 10) : DEFAULT_RANGE_HOURS;

  if (isNaN(rangeHours) || rangeHours <= 0) {
    return res.status(400).json({ error: 'Invalid rangeHours parameter. Must be a positive number.' });
  }

  console.log(`Fetching TPS samples for subnet ${subnetId} for the last ${rangeHours} hours`);
  const samples = await getTpsSamples(subnetId, rangeHours);
  res.json(samples);
}));

// GET /api/metrics/:subnetId/tps/average - Fetch average TPS
router.get('/:subnetId/tps/average', asyncHandler(async (req: Request, res: Response) => {
  const { subnetId } = req.params;
  const rangeHours = req.query.rangeHours ? parseInt(req.query.rangeHours as string, 10) : DEFAULT_RANGE_HOURS;

  if (isNaN(rangeHours) || rangeHours <= 0) {
    return res.status(400).json({ error: 'Invalid rangeHours parameter. Must be a positive number.' });
  }

  const averageData = await getAverageTps(subnetId, rangeHours);
  res.json(averageData);
}));

// GET /api/metrics/:subnetId/blocktime - Fetch stored block time samples for a given subnet
router.get('/:subnetId/blocktime', asyncHandler(async (req: Request, res: Response) => {
  const { subnetId } = req.params;
  const rangeHours = req.query.rangeHours ? parseInt(req.query.rangeHours as string, 10) : DEFAULT_RANGE_HOURS;

  if (isNaN(rangeHours) || rangeHours <= 0) {
    return res.status(400).json({ error: 'Invalid rangeHours parameter. Must be a positive number.' });
  }

  console.log(`Fetching block time samples for subnet ${subnetId} for the last ${rangeHours} hours`);
  const samples = await getBlocktimeSamples(subnetId, rangeHours);
  res.json(samples);
}));

// GET /api/metrics/:subnetId/blocktime/average - Fetch average block time
router.get('/:subnetId/blocktime/average', asyncHandler(async (req: Request, res: Response) => {
  const { subnetId } = req.params;
  const rangeHours = req.query.rangeHours ? parseInt(req.query.rangeHours as string, 10) : DEFAULT_RANGE_HOURS;

  if (isNaN(rangeHours) || rangeHours <= 0) {
    return res.status(400).json({ error: 'Invalid rangeHours parameter. Must be a positive number.' });
  }

  const averageData = await getAverageBlockTime(subnetId, rangeHours);
  res.json(averageData);
}));

// NEW ROUTES for ERC20, ERC721, GasUtilization

// GET /api/metrics/:subnetId/erc20transfers - Fetch stored ERC20 transfer counts
router.get('/:subnetId/erc20transfers', asyncHandler(async (req: Request, res: Response) => {
  const { subnetId } = req.params;
  const rangeHours = req.query.rangeHours ? parseInt(req.query.rangeHours as string, 10) : DEFAULT_RANGE_HOURS;
  if (isNaN(rangeHours) || rangeHours <= 0) {
    return res.status(400).json({ error: 'Invalid rangeHours. Must be a positive number.' });
  }
  console.log(`Fetching ERC20 transfer counts for subnet ${subnetId} for the last ${rangeHours} hours`);
  const samples = await getErc20TransferCounts(subnetId, rangeHours);
  res.json(samples);
}));

// GET /api/metrics/:subnetId/erc721transfers - Fetch stored ERC721 transfer counts
router.get('/:subnetId/erc721transfers', asyncHandler(async (req: Request, res: Response) => {
  const { subnetId } = req.params;
  const rangeHours = req.query.rangeHours ? parseInt(req.query.rangeHours as string, 10) : DEFAULT_RANGE_HOURS;
  if (isNaN(rangeHours) || rangeHours <= 0) {
    return res.status(400).json({ error: 'Invalid rangeHours. Must be a positive number.' });
  }
  console.log(`Fetching ERC721 transfer counts for subnet ${subnetId} for the last ${rangeHours} hours`);
  const samples = await getErc721TransferCounts(subnetId, rangeHours);
  res.json(samples);
}));

// GET /api/metrics/:subnetId/gasutilization - Fetch stored gas utilization samples
router.get('/:subnetId/gasutilization', asyncHandler(async (req: Request, res: Response) => {
  const { subnetId } = req.params;
  const rangeHours = req.query.rangeHours ? parseInt(req.query.rangeHours as string, 10) : DEFAULT_RANGE_HOURS;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : DEFAULT_GAS_SAMPLES_LIMIT;
  
  if (isNaN(rangeHours) || rangeHours <= 0) {
    return res.status(400).json({ error: 'Invalid rangeHours. Must be a positive number.' });
  }
  if (isNaN(limit) || limit <= 0) {
    return res.status(400).json({ error: 'Invalid limit. Must be a positive number.' });
  }

  console.log(`Fetching gas utilization samples for subnet ${subnetId} for the last ${rangeHours} hours, limit ${limit}`);
  const samples = await getGasUtilizationSamples(subnetId, rangeHours, limit);
  res.json(samples);
}));

export default router; 