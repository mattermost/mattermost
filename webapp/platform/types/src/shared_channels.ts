// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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

    /** Omitted when when {@link SharedChannel.home} is `false` */
    remote_id?: string;
};

export type SharedChannelRemote = {
    id: string;
    channel_id: string;
    creator_id: string;
    create_at: number;
    update_at: number;
    is_invite_accepted: boolean;
    is_invite_confirmed: boolean;
    remote_id: string;
    last_post_update_at: number;
    last_post_id: string;
    last_post_create_at: number;
    last_post_create_id: string;
}
