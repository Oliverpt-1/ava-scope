import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient'; // User-context client

export interface AuthenticatedRequest extends Request {
  user?: any; // You can replace 'any' with a more specific User interface from Supabase if available
}

export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or malformed Bearer token.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Token not found.' });
    return;
  }

  try {
    // Verify the token and get user data
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      console.error('Auth middleware error - getUser failed:', error.message);
      res.status(401).json({ error: 'Unauthorized: Invalid token.', details: error.message });
      return;
    }

    if (!user) {
      res.status(401).json({ error: 'Unauthorized: User not found for token.' });
      return;
    }

    // Attach user to the request object for use in subsequent route handlers
    req.user = user;
    
    // It's also good practice to set the session for the Supabase client instance for this request scope,
    // so that RLS policies using auth.uid() work correctly in helper functions called by routes.
    // Note: For some operations, merely having req.user might be enough if you pass user.id explicitly.
    // However, for RLS to work automatically based on auth.uid() in policies, the client needs the session.
    // The specifics can depend on how supabase-js handles server-side auth context per request.
    // A common pattern is to re-initialize or set context on a request-scoped client.
    // For now, we'll rely on RLS checking auth.uid() which Supabase should populate from the JWT.
    // If RLS fails with this setup, we might need to explicitly set the session on the client for the request.

    next(); // Proceed to the next middleware or route handler
  } catch (error: any) {
    console.error('Auth middleware unexpected error:', error.message);
    res.status(500).json({ error: 'Internal server error during authentication.' });
    return;
  }
}; 