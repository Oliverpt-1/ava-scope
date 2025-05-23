-- Ensure the uuid-ossp extension is enabled for uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Remove mempool_samples table and its related policies and indexes
DROP TABLE IF EXISTS public.mempool_samples CASCADE;
-- DROP POLICY IF EXISTS "Allow users to manage their own mempool samples OR allow service_role" ON public.mempool_samples;
-- DROP POLICY IF EXISTS "TEST_MEMPOOL_SERVICE_ROLE_ONLY_ACCESS" ON public.mempool_samples;
-- DROP POLICY IF EXISTS "TEMP - Service Role ONLY for Mempool" ON public.mempool_samples;
-- DROP POLICY IF EXISTS "Allow users to manage their own mempool samples" ON public.mempool_samples;
DROP INDEX IF EXISTS idx_mempool_samples_subnet_timestamp;


-- Table: tps_samples (Keep as is, per instructions)
CREATE TABLE IF NOT EXISTS public.tps_samples (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subnet_id UUID NOT NULL REFERENCES public.subnets(id) ON DELETE CASCADE,
    sampled_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    tps_value REAL NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.tps_samples ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to manage their own tps samples OR allow service_role" ON public.tps_samples;
DROP POLICY IF EXISTS "Allow users to manage their own tps samples" ON public.tps_samples;
CREATE POLICY "Allow users to manage their own tps samples" 
ON public.tps_samples
FOR ALL
USING (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id))
WITH CHECK (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id));

-- Table: blocktime_samples (Keep as is, per instructions)
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
DROP POLICY IF EXISTS "Allow users to manage their own blocktime samples" ON public.blocktime_samples;
CREATE POLICY "Allow users to manage their own blocktime samples" 
ON public.blocktime_samples
FOR ALL
USING (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id))
WITH CHECK (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id));

-- Table: gas_utilization_samples (Renamed from gas_samples, added gas_limit and utilization_percentage)
DROP TABLE IF EXISTS public.gas_samples CASCADE; -- Drop old table if exists
DROP INDEX IF EXISTS idx_gas_samples_subnet_block_timestamp;

CREATE TABLE IF NOT EXISTS public.gas_utilization_samples (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subnet_id UUID NOT NULL REFERENCES public.subnets(id) ON DELETE CASCADE,
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ NOT NULL,
    gas_used BIGINT NOT NULL,
    gas_limit BIGINT NOT NULL,
    utilization_percentage REAL NOT NULL, -- gas_used / gas_limit * 100
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (subnet_id, block_number) -- Ensure one entry per block
);
ALTER TABLE public.gas_utilization_samples ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to manage their own gas utilization samples" ON public.gas_utilization_samples;
CREATE POLICY "Allow users to manage their own gas utilization samples"
ON public.gas_utilization_samples
FOR ALL
USING (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id))
WITH CHECK (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id));

-- Table: erc20_transfer_counts (New table for ERC20 transfers per minute)
CREATE TABLE IF NOT EXISTS public.erc20_transfer_counts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subnet_id UUID NOT NULL REFERENCES public.subnets(id) ON DELETE CASCADE,
    minute_timestamp TIMESTAMPTZ NOT NULL, -- Timestamp rounded to the minute
    transfer_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (subnet_id, minute_timestamp) -- Ensure one entry per subnet per minute
);
ALTER TABLE public.erc20_transfer_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to manage their own erc20 counts" ON public.erc20_transfer_counts;
CREATE POLICY "Allow users to manage their own erc20 counts"
ON public.erc20_transfer_counts
FOR ALL
USING (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id))
WITH CHECK (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id));

-- Table: erc721_transfer_counts (New table for ERC721 transfers per minute)
CREATE TABLE IF NOT EXISTS public.erc721_transfer_counts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subnet_id UUID NOT NULL REFERENCES public.subnets(id) ON DELETE CASCADE,
    minute_timestamp TIMESTAMPTZ NOT NULL, -- Timestamp rounded to the minute
    transfer_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (subnet_id, minute_timestamp) -- Ensure one entry per subnet per minute
);
ALTER TABLE public.erc721_transfer_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to manage their own erc721 counts" ON public.erc721_transfer_counts;
CREATE POLICY "Allow users to manage their own erc721 counts"
ON public.erc721_transfer_counts
FOR ALL
USING (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id))
WITH CHECK (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id));


-- Add/Update indexes for frequent query patterns 
CREATE INDEX IF NOT EXISTS idx_tps_samples_subnet_timestamp ON public.tps_samples(subnet_id, sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_blocktime_samples_subnet_block_timestamp ON public.blocktime_samples(subnet_id, block_number DESC, block_timestamp DESC); 
CREATE INDEX IF NOT EXISTS idx_gas_utilization_samples_subnet_timestamp ON public.gas_utilization_samples(subnet_id, block_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gas_utilization_samples_subnet_block ON public.gas_utilization_samples(subnet_id, block_number DESC);
CREATE INDEX IF NOT EXISTS idx_erc20_transfer_counts_subnet_timestamp ON public.erc20_transfer_counts(subnet_id, minute_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_erc721_transfer_counts_subnet_timestamp ON public.erc721_transfer_counts(subnet_id, minute_timestamp DESC); 