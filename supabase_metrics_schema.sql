-- Ensure the uuid-ossp extension is enabled for uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: mempool_samples
CREATE TABLE IF NOT EXISTS public.mempool_samples (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subnet_id UUID NOT NULL REFERENCES public.subnets(id) ON DELETE CASCADE,
    sampled_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    pending_tx_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.mempool_samples ENABLE ROW LEVEL SECURITY;
-- Drop all potentially existing policies to apply the original one cleanly
DROP POLICY IF EXISTS "Allow users to manage their own mempool samples OR allow service_role" ON public.mempool_samples;
DROP POLICY IF EXISTS "TEST_MEMPOOL_SERVICE_ROLE_ONLY_ACCESS" ON public.mempool_samples;
DROP POLICY IF EXISTS "TEMP - Service Role ONLY for Mempool" ON public.mempool_samples;
DROP POLICY IF EXISTS "Allow users to manage their own mempool samples" ON public.mempool_samples; -- Original name
-- Apply original user-centric RLS policy
CREATE POLICY "Allow users to manage their own mempool samples" 
ON public.mempool_samples
FOR ALL
USING (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id))
WITH CHECK (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id));

-- Table: tps_samples
CREATE TABLE IF NOT EXISTS public.tps_samples (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subnet_id UUID NOT NULL REFERENCES public.subnets(id) ON DELETE CASCADE,
    sampled_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    tps_value REAL NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.tps_samples ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to manage their own tps samples OR allow service_role" ON public.tps_samples;
DROP POLICY IF EXISTS "Allow users to manage their own tps samples" ON public.tps_samples; -- Original name
-- Apply original user-centric RLS policy
CREATE POLICY "Allow users to manage their own tps samples" 
ON public.tps_samples
FOR ALL
USING (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id))
WITH CHECK (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id));

-- Table: gas_samples
CREATE TABLE IF NOT EXISTS public.gas_samples (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subnet_id UUID NOT NULL REFERENCES public.subnets(id) ON DELETE CASCADE,
    block_number BIGINT NOT NULL,
    gas_used BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.gas_samples ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to manage their own gas samples OR allow service_role" ON public.gas_samples;
DROP POLICY IF EXISTS "Allow users to manage their own gas samples" ON public.gas_samples; -- Original name
-- Apply original user-centric RLS policy
CREATE POLICY "Allow users to manage their own gas samples" 
ON public.gas_samples
FOR ALL
USING (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id))
WITH CHECK (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id));

-- Table: blocktime_samples
CREATE TABLE IF NOT EXISTS public.blocktime_samples (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subnet_id UUID NOT NULL REFERENCES public.subnets(id) ON DELETE CASCADE,
    block_number BIGINT NOT NULL,
    block_time_seconds REAL NOT NULL,
    block_timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.blocktime_samples ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to manage their own blocktime samples OR allow service_role" ON public.blocktime_samples;
DROP POLICY IF EXISTS "Allow users to manage their own blocktime samples" ON public.blocktime_samples; -- Original name
-- Apply original user-centric RLS policy
CREATE POLICY "Allow users to manage their own blocktime samples" 
ON public.blocktime_samples
FOR ALL
USING (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id))
WITH CHECK (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id));

-- Add indexes for frequent query patterns 
CREATE INDEX IF NOT EXISTS idx_mempool_samples_subnet_timestamp ON public.mempool_samples(subnet_id, sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_tps_samples_subnet_timestamp ON public.tps_samples(subnet_id, sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_gas_samples_subnet_block_timestamp ON public.gas_samples(subnet_id, block_number DESC, block_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_blocktime_samples_subnet_block_timestamp ON public.blocktime_samples(subnet_id, block_number DESC, block_timestamp DESC); 