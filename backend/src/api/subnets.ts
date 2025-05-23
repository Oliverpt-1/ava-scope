import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { asyncHandler } from './asyncHandler';

const router = Router();

// GET /api/subnets - List all subnets for the logged-in user
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  // TODO: Implement authentication and retrieve userId
  const userId = 'mock-user-id'; // Placeholder
  const { data, error } = await supabase
    .from('subnets')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  res.json(data);
}));

// POST /api/subnets - Add a new subnet
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name, rpc_url } = req.body;
  // TODO: Implement authentication and retrieve userId
  const userId = 'mock-user-id'; // Placeholder
  if (!name || !rpc_url) {
    return res.status(400).json({ error: 'Name and rpc_url are required' });
  }
  const { data, error } = await supabase
    .from('subnets')
    .insert([{ name, rpc_url, user_id: userId }])
    .select();
  if (error) throw error;
  res.status(201).json(data ? data[0] : null);
}));

// DELETE /api/subnets/:id - Delete a user's subnet
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  // TODO: Implement authentication and retrieve userId
  const userId = 'mock-user-id'; // Placeholder
  const { error, count } = await supabase
    .from('subnets')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;

  if (count === 0) {
    return res.status(404).json({ error: 'Subnet not found or access denied' });
  }
  res.status(204).send();
}));

export default router; 