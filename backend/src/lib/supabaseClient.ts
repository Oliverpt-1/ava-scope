import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config(); // .env should be in the same directory as package.json (backend root)

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or anon key not defined in .env file');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 