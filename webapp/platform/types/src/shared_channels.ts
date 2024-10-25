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
