// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type Role = {
    id: string;
    name: string;
    display_name: string;
    description: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    permissions: string[];
    scheme_managed: boolean;
    built_in: boolean;
};

export type RolesState = {
    system_admin: Role;
    team_admin: Role;
    channel_admin: Role;
    playbook_admin: Role;
    playbook_member: Role;
    run_admin: Role;
    run_member: Role;
    all_users: {name: string; display_name: string; permissions: Role['permissions']};
    guests: {name: string; display_name: string; permissions: Role['permissions']};
}

