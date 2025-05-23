import dotenv from 'dotenv';
import path from 'path';

// __dirname in this file will be backend/src/config/
// So, path.resolve(__dirname, '../../.env') will point to backend/.env
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

console.log(`[EnvLoader] Attempted to load .env from: ${envPath}`);
console.log(`[EnvLoader] SUPABASE_URL loaded: ${process.env.SUPABASE_URL ? 'Yes' : 'No'}`);
console.log(`[EnvLoader] SUPABASE_SERVICE_ROLE_KEY loaded: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Yes' : 'No'}`); 