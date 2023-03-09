// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TeamMembership} from './teams';

export type Session = {
    id: string;
    token: string;
    create_at: number;
    expires_at: number;
    last_activity_at: number;
    user_id: string;
    device_id: string;
    roles: string;
    is_oauth: boolean;
    props: Record<string, any>;
    team_members: TeamMembership[];
    local: boolean;
}
