-- Ensure the uuid-ossp extension is enabled for uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: mempool_samples
CREATE TABLE public.mempool_samples (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subnet_id UUID NOT NULL REFERENCES public.subnets(id) ON DELETE CASCADE,
    sampled_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    pending_tx_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.mempool_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to manage their own mempool samples" 
ON public.mempool_samples
FOR ALL
USING (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id))
WITH CHECK (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id));

-- Table: tps_samples
CREATE TABLE public.tps_samples (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subnet_id UUID NOT NULL REFERENCES public.subnets(id) ON DELETE CASCADE,
    sampled_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    tps_value REAL NOT NULL, -- Using REAL for floating point TPS values
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.tps_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to manage their own tps samples" 
ON public.tps_samples
FOR ALL
USING (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id))
WITH CHECK (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id));

-- Table: gas_samples
CREATE TABLE public.gas_samples (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subnet_id UUID NOT NULL REFERENCES public.subnets(id) ON DELETE CASCADE,
    block_number BIGINT NOT NULL,
    gas_used BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ NOT NULL, -- Timestamp of the block itself
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Optional: Add a unique constraint or index if a subnet can't have multiple gas samples for the same block
-- CREATE UNIQUE INDEX idx_gas_samples_subnet_block ON public.gas_samples(subnet_id, block_number);

ALTER TABLE public.gas_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to manage their own gas samples" 
ON public.gas_samples
FOR ALL
USING (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id))
WITH CHECK (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id));

-- Table: blocktime_samples
CREATE TABLE public.blocktime_samples (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subnet_id UUID NOT NULL REFERENCES public.subnets(id) ON DELETE CASCADE,
    block_number BIGINT NOT NULL,
    block_time_seconds REAL NOT NULL, -- Time taken to produce this block, or avg time up to this block
    block_timestamp TIMESTAMPTZ NOT NULL, -- Timestamp of the block itself
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Optional: Add a unique constraint or index if a subnet can't have multiple blocktime samples for the same block
-- CREATE UNIQUE INDEX idx_blocktime_samples_subnet_block ON public.blocktime_samples(subnet_id, block_number);

ALTER TABLE public.blocktime_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to manage their own blocktime samples" 
ON public.blocktime_samples
FOR ALL
USING (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id))
WITH CHECK (auth.uid() = (SELECT user_id FROM public.subnets WHERE id = subnet_id));

-- Add indexes for frequent query patterns (e.g., querying by subnet_id and time/block_number)
CREATE INDEX IF NOT EXISTS idx_mempool_samples_subnet_timestamp ON public.mempool_samples(subnet_id, sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_tps_samples_subnet_timestamp ON public.tps_samples(subnet_id, sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_gas_samples_subnet_block_timestamp ON public.gas_samples(subnet_id, block_number DESC, block_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_blocktime_samples_subnet_block_timestamp ON public.blocktime_samples(subnet_id, block_number DESC, block_timestamp DESC); 