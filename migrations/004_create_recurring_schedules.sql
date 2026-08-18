CREATE TABLE IF NOT EXISTS recurring_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL, -- e.g. '0 9,18 * * *'
    platform VARCHAR(50) NOT NULL,        -- 'linkedin' | 'twitter' | 'instagram' | 'facebook'
    target_topic VARCHAR(255) NOT NULL,
    target_domain VARCHAR(255) DEFAULT 'ALL',
    auto_publish BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recurring_schedules_active ON recurring_schedules(is_active);