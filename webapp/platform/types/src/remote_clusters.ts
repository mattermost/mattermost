// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type RemoteClusterInvite = {
    remote_id: string;
    remote_team_id: string;
    site_url: string;
    token: string;
};

export type RemoteClusterAcceptInvite = {
    name: string;
    display_name: string;
    default_team_id: string;
    invite: string;
    password: string;
}

export type RemoteClusterPatch = Pick<RemoteCluster, 'display_name' | 'default_team_id'>

export function isRemoteClusterPatch(x: Partial<RemoteClusterPatch>): x is RemoteClusterPatch {
    return (
        (x.display_name !== undefined && x.display_name !== '') ||
        x.default_team_id !== undefined
    );
}

export type RemoteCluster = {
    remote_id: string;
    remote_team_id: string;
    name: string;
    display_name: string;
    site_url: string;
    create_at: number;
    delete_at: number;
    last_ping_at: number;
    token?: string;
    remote_token?: string;
    topics: string;
    creator_id: string;
    plugin_id: string;
    options: number;
    default_team_id: string;
}

export type RemoteClusterWithPassword = RemoteCluster & {
    password: string;
}
