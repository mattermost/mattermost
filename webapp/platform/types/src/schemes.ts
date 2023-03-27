// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type SchemeScope = 'team' | 'channel';
export type Scheme = {
    id: string;
    name: string;
    description: string;
    display_name: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    scope: SchemeScope;
    default_team_admin_role: string;
    default_team_user_role: string;
    default_team_guest_role: string;
    default_channel_admin_role: string;
    default_channel_user_role: string;
    default_channel_guest_role: string;
    default_playbook_admin_role: string;
    default_playbook_member_role: string;
    default_run_member_role: string;
};
export type SchemesState = {
    schemes: {
        [x: string]: Scheme;
    };
};
export type SchemePatch = {
    name?: string;
    description?: string;
};
