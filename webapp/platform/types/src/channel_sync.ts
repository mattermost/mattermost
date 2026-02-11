export type ChannelSyncCategory = {
    id: string;
    display_name: string;
    sort_order: number;
    channel_ids: string[];
};

export type ChannelSyncLayout = {
    team_id: string;
    categories: ChannelSyncCategory[];
    update_at: number;
    update_by: string;
};

export type ChannelSyncUserCategory = {
    id: string;
    display_name: string;
    sort_order: number;
    collapsed: boolean;
    muted: boolean;
    channel_ids: string[];
    quick_join: string[];
};

export type ChannelSyncUserState = {
    team_id: string;
    should_sync: boolean;
    categories: ChannelSyncUserCategory[];
};
