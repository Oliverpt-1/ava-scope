import { Router, Request, Response } from 'express';
import { asyncHandler } from './asyncHandler';
import { getMetrics } from '../services/metrics'; // This will be created next

const router = Router();

// GET /api/metrics/:subnetId - Fetch metrics for a given subnet
router.get('/:subnetId', asyncHandler(async (req: Request, res: Response) => {
  const { subnetId } = req.params;
  // TODO: In a real app, you'd fetch the subnet's RPC URL from your database
  // using subnetId and the authenticated user ID to ensure they own the subnet.
  // For now, we'll assume a mock RPC URL or pass it directly if your design changes.
  //const mockRpcUrl = `https://subnets.avax.network/animalia/mainnet/rpc`; // animalia RPC
  const mockRpcUrl = 'https://subnets.avax.network/beam/mainnet/rpc'; // beam RPC

  console.log(`Fetching metrics for subnet ${subnetId} using RPC: ${mockRpcUrl}`);

  // Fetch metrics using the service
  // No try-catch here for getMetrics because asyncHandler will catch its errors
  const metrics = getMetrics(mockRpcUrl);
  
  // Simulate potential fetching error for frontend testing
  if (subnetId === 'error') {
    // This is a mock error condition for testing frontend error handling
    throw new Error('Failed to fetch metrics for subnet ' + subnetId);
  }

  res.json(metrics);
}));

export default router; 