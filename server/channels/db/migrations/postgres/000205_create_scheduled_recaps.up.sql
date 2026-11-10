-- ScheduledRecaps table: stores scheduled recap configuration
CREATE TABLE IF NOT EXISTS ScheduledRecaps (
    Id VARCHAR(26) PRIMARY KEY,
    UserId VARCHAR(26) NOT NULL,
    Title VARCHAR(255) NOT NULL,

    -- Schedule configuration (user intent)
    DaysOfWeek INT NOT NULL,
    TimeOfDay VARCHAR(5) NOT NULL,
    Timezone VARCHAR(64) NOT NULL,
    TimePeriod VARCHAR(32) NOT NULL,

    -- Schedule state (computed)
    NextRunAt BIGINT NOT NULL,
    LastRunAt BIGINT DEFAULT 0 NOT NULL,
    RunCount INT DEFAULT 0 NOT NULL,

    -- Channel configuration
    ChannelMode VARCHAR(32) NOT NULL,
    ChannelIds jsonb NOT NULL DEFAULT '[]'::jsonb,

    -- AI configuration
    CustomInstructions TEXT,
    AgentId VARCHAR(26) DEFAULT '' NOT NULL,

    -- Schedule type and state
    IsRecurring BOOLEAN DEFAULT true NOT NULL,
    Enabled BOOLEAN DEFAULT true NOT NULL,

    -- Standard timestamps
    CreateAt BIGINT NOT NULL,
    UpdateAt BIGINT NOT NULL,
    DeleteAt BIGINT DEFAULT 0 NOT NULL
);
