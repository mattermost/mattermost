// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
