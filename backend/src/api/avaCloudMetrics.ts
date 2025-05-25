import { Router, Request, Response } from 'express';
import { AvaCloudSDK } from '@avalabs/avacloud-sdk';
import { asyncHandler } from './asyncHandler';

/*
  Lightweight wrappers around the AvaCloud Metrics endpoints.
  All routes expect the caller to be authenticated via authMiddleware (mounted in index.ts).

  Query parameters are passed straight through to the SDK call so the front-end has full control.
*/

const router = Router();

/**
 * Helper – create an SDK instance for each request so we can safely mutate params.
 */
const createSdk = () => {
  const serverURL = process.env.AVACLOUD_API_URL;
  const apiKeyFromEnv = process.env.AVACLOUD_API_KEY;

  // TEMPORARY DEBUG LOG: Check if API key is loaded from .env
  console.log('[DEBUG] createSdk - AVACLOUD_API_KEY from env:', apiKeyFromEnv ? `******${apiKeyFromEnv.slice(-4)}` : 'NOT FOUND or UNDEFINED');

  const sdkOptions: any = { 
    apiKey: apiKeyFromEnv as string,
  };
  if (serverURL) {
    sdkOptions.serverURL = serverURL;
  } else {
    console.warn(
      'AVACLOUD_API_URL not set in .env; SDK will use its default. This may not be https://metrics.avax.network.',
    );
  }
  return new AvaCloudSDK(sdkOptions);
};

/**
 * GET /api/avacloud/teleporter
 * Required query params:
 *   chainId (string)
 *   metric  (teleporterSourceTxnCount | teleporterDestinationTxnCount | teleporterTotalTxnCount)
 */
router.get(
  '/teleporter',
  asyncHandler(async (req: Request, res: Response) => {
    const serverURL = process.env.AVACLOUD_API_URL;
    const apiKeyFromEnv = process.env.AVACLOUD_API_KEY;
    const { chainId, metric } = req.query;

    if (!chainId || typeof chainId !== 'string') {
      return res.status(400).json({ error: 'Missing required query param: chainId' });
    }
    if (!metric || typeof metric !== 'string') {
      return res.status(400).json({ error: 'Missing required query param: metric' });
    }

    try {
      const _sdk = new AvaCloudSDK({
        serverURL: String(serverURL),
        chainId: chainId,
        network: "mainnet"
      });
      console.log("ChainId and metric,", chainId, metric);

     // const result = await _sdk.metrics.chains.getTeleporterMetrics({
     //   metric: metric,
     //   chainId: chainId
     // });
   //   return res.status(200).json(result);
    } catch (err: any) {
      console.error(
        `AvaCloud teleporter metrics error for chainId: ${chainId}, metric: ${metric}:`,
        err.message,
        err.stack,
        err.response?.data,
        JSON.stringify(err),
      );
      return res.status(500).json({ error: 'Failed to fetch teleporter metrics' });
    }
  }),
);

/**
 * GET /api/avacloud/staking
 * Required query params:
 *   network (mainnet | fuji | testnet)
 *   metric  (delegatorCount | delegatorWeight | validatorCount | validatorWeight)
 * Optional query params:
 *   startTimestamp, endTimestamp, subnetId, pageSize, pageToken
 */
router.get(
  '/staking',
  asyncHandler(async (req: Request, res: Response) => {
    const { network, metric, startTimestamp, endTimestamp, subnetId, pageSize, pageToken } = req.query;

    if (!network || typeof network !== 'string') {
      return res.status(400).json({ error: 'Missing required query param: network' });
    }
    if (!metric || typeof metric !== 'string') {
      return res.status(400).json({ error: 'Missing required query param: metric' });
    }

    try {
      const sdk = createSdk();
      // Build params object dynamically – only include optional values if provided.
      const params: Record<string, any> = { network, metric };
      if (startTimestamp) params.startTimestamp = Number(startTimestamp);
      if (endTimestamp) params.endTimestamp = Number(endTimestamp);
      if (subnetId) params.subnetId = subnetId;
      if (pageSize) params.pageSize = Number(pageSize);
      if (pageToken) params.pageToken = pageToken;

      const iterable = await sdk.metrics.chain.metrics.getStakingMetrics(params as any);
      const pages: any[] = [];
      for await (const page of iterable) pages.push(page);
      return res.status(200).json(pages);
    } catch (err) {
      console.error('AvaCloud staking metrics error:', err);
      return res.status(500).json({ error: 'Failed to fetch staking metrics' });
    }
  }),
);

/**
 * GET /api/avacloud/chain
 * Required query params:
 *   chainId (string)
 *   metric  (see AvaCloud docs, e.g. activeAddresses, txCount …)
 * Optional query params:
 *   startTimestamp, endTimestamp, timeInterval, pageSize, pageToken
 */
router.get(
  '/chain',
  asyncHandler(async (req: Request, res: Response) => {
    const { chainId, metric, startTimestamp, endTimestamp, timeInterval, pageSize, pageToken } = req.query;

    if (!chainId || typeof chainId !== 'string') {
      return res.status(400).json({ error: 'Missing required query param: chainId' });
    }
    if (!metric || typeof metric !== 'string') {
      return res.status(400).json({ error: 'Missing required query param: metric' });
    }

    try {
      const sdk = createSdk();
      const params: Record<string, any> = { chainId, metric };
      if (startTimestamp) params.startTimestamp = Number(startTimestamp);
      if (endTimestamp) params.endTimestamp = Number(endTimestamp);
      if (timeInterval) params.timeInterval = timeInterval;
      if (pageSize) params.pageSize = Number(pageSize);
      if (pageToken) params.pageToken = pageToken;

      const iterable = await sdk.metrics.chain.metrics.getEvmChainMetrics(params as any);
      const pages: any[] = [];
      for await (const page of iterable) pages.push(page);
      return res.status(200).json(pages);
    } catch (err) {
      console.error('AvaCloud chain metrics error:', err);
      return res.status(500).json({ error: 'Failed to fetch chain metrics' });
    }
  }),
);

export default router; 