import { Router, Request, Response } from 'express';
import { asyncHandler } from './asyncHandler'; // Assuming asyncHandler is in the same directory: src/api/
import { 
  getMempoolSamples, 
  getTpsSamples, 
  getBlocktimeSamples,
  getAverageBlockTime,
  getAverageTps
} from '../lib/supabaseHelpers'; // Corrected path to lib/

const router = Router();

const DEFAULT_RANGE_HOURS = 24;

// GET /api/metrics/:subnetId/mempool - Fetch stored mempool samples for a given subnet
router.get('/:subnetId/mempool', asyncHandler(async (req: Request, res: Response) => {
  const { subnetId } = req.params;
  const rangeHours = req.query.rangeHours ? parseInt(req.query.rangeHours as string, 10) : DEFAULT_RANGE_HOURS;

  if (isNaN(rangeHours) || rangeHours <= 0) {
    return res.status(400).json({ error: 'Invalid rangeHours parameter. Must be a positive number.' });
  }

  // TODO: Validate subnetId format (e.g., UUID)
  // TODO: Authenticate user and verify they have access to this subnetId

  console.log(`Fetching mempool samples for subnet ${subnetId} for the last ${rangeHours} hours`);
  const samples = await getMempoolSamples(subnetId, rangeHours);
  res.json(samples);
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

// Note: The old GET /api/metrics/:subnetId route that fetched LIVE metrics directly via getMetrics(rpcUrl)
// has been removed in favor of these routes that fetch STORED time-series data.
// If live, on-demand metrics are still needed, that route could be re-added or adapted.

export default router; 