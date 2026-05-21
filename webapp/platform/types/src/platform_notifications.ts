// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from './channels';
import type {Post} from './posts';
import type {Team} from './teams';
import type {UserProfile} from './users';

export type PlatformNotification = {
    id: string;
    user_id: UserProfile['id'];
    post_id: Post['id'];
    channel_id: Channel['id'];
    team_id: Team['id'];
    recorded_at: number;
    read_at?: number;
    channel_display_name: string;
    context_label: string;
    permalink_url: string;
    is_thread_reply: boolean;
    is_mention?: boolean;
    is_direct_message?: boolean;
    sender_user_id?: UserProfile['id'];
    thread_root_id?: Post['id'];
    reply_count?: number;
    participant_user_ids?: UserProfile['id'][];
    preview_body: string;
};
