// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type SharedChannelRemote = {
    id: string;
    channel_id: string;
    creator_id: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    is_invite_accepted: boolean;
    is_invite_confirmed: boolean;
    remote_id: string;
    last_post_update_at: number;
    last_post_id: string;
    last_post_create_at: number;
    last_post_create_id: string;
}

export type RemoteClusterInfo = {
    name: string;
    display_name: string;
    create_at: number;
    delete_at: number;
    last_ping_at: number;
}

export type SharedChannel = {
    id: string;
    team_id: string;
    home: boolean;
    readonly: boolean;
    name: string;
    display_name: string;
    purpose: string;
    header: string;
    creator_id: string;
    create_at: number;
    update_at: number;
    remote_id: string;
}

export type SharedChannelWithRemotes = {
    shared_channel: SharedChannel;
    remotes: RemoteClusterInfo[];
}

export type SharedChannelsState = {
    sharedChannelsWithRemotes: Record<string, SharedChannelWithRemotes>;
    remoteNames: Record<string, string[]>;
}
