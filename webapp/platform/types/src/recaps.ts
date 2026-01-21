// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type Recap = {
    id: string;
    user_id: string;
    title: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    read_at: number;
    total_message_count: number;
    status: RecapStatus;
    bot_id: string;
    channels?: RecapChannel[];
};

export type RecapChannel = {
    id: string;
    recap_id: string;
    channel_id: string;
    channel_name: string;
    highlights: string[];
    action_items: string[];
    source_post_ids: string[];
    create_at: number;
};

export type CreateRecapRequest = {
    title: string;
    channel_ids: string[];
    agent_id: string;
};

export enum RecapStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

export type ScheduledRecap = {
    id: string;
    user_id: string;
    title: string;

    // Schedule configuration
    days_of_week: number;      // Bitmask: Sun=1, Mon=2, Tue=4, Wed=8, Thu=16, Fri=32, Sat=64
    time_of_day: string;       // HH:MM format
    timezone: string;          // IANA timezone
    time_period: string;       // "last_24h" | "last_week" | "since_last_read"

    // Schedule state
    next_run_at: number;       // UTC milliseconds
    last_run_at: number;       // UTC milliseconds
    run_count: number;

    // Channel configuration
    channel_mode: string;      // "specific" | "all_unreads"
    channel_ids?: string[];    // Present when mode = "specific"

    // AI configuration
    custom_instructions?: string;
    agent_id: string;

    // Schedule type and state
    is_recurring: boolean;
    enabled: boolean;

    // Timestamps
    create_at: number;
    update_at: number;
    delete_at: number;
};

export type ScheduledRecapInput = {
    title: string;
    days_of_week: number;
    time_of_day: string;
    timezone: string;
    time_period: string;
    channel_mode: string;
    channel_ids?: string[];
    custom_instructions?: string;
    agent_id: string;
    is_recurring: boolean;
};

