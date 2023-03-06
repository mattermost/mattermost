// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel} from '@mattermost/types/channels';

export interface OwnerInfo {
    user_id: string;
    username: string;
    first_name: string;
    last_name: string;
    nickname: string;
}

export type ChannelNamesMap = {
    [name: string]: {
        display_name: string;
        team_name?: string;
    } | Channel;
};
