// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    AppFieldTypes,
} from './app_command_parser_test_dependencies';
import type {
    AppBinding,
    AppForm} from './app_command_parser_test_dependencies';

export const reduxTestState = {
    entities: {
        channels: {
            currentChannelId: 'current_channel_id',
            myMembers: {
                current_channel_id: {
                    channel_id: 'current_channel_id',
                    user_id: 'current_user_id',
                    roles: 'channel_role',
                    mention_count: 1,
                    msg_count: 9,
                },
            },
            channels: {
                current_channel_id: {
                    id: 'current_channel_id',
                    name: 'default-name',
                    display_name: 'Default',
                    delete_at: 0,
                    type: 'O',
                    team_id: 'team_id',
                },
                current_user_id__existingId: {
                    id: 'current_user_id__existingId',
                    name: 'current_user_id__existingId',
                    display_name: 'Default',
                    delete_at: 0,
                    type: '0',
                    team_id: 'team_id',
                },
            },
            channelsInTeam: {
                'team-id': new Set(['current_channel_id']),
            },
            messageCounts: {
                current_channel_id: {total: 10},
                current_user_id__existingId: {total: 0},
            },
        },
        teams: {
            currentTeamId: 'team-id',
            teams: {
                'team-id': {
                    id: 'team_id',
                    name: 'team-1',
                    displayName: 'Team 1',
                },
            },
            myMembers: {
                'team-id': {roles: 'team_role'},
            },
        },
        users: {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_role'},
            },
        },
        preferences: {
            myPreferences: {
                'display_settings--name_format': {
                    category: 'display_settings',
                    name: 'name_format',
                    user_id: 'current_user_id',
                    value: 'username',
                },
            },
        },
        roles: {
            roles: {
                system_role: {
                    permissions: [],
                },
                team_role: {
                    permissions: [],
                },
                channel_role: {
                    permissions: [],
                },
            },
        },
        general: {
            license: {IsLicensed: 'false'},
            serverVersion: '5.25.0',
            config: {
                PostEditTimeLimit: -1,
                FeatureFlagAppsEnabled: 'true',
            },
        },
    },
};

export const viewCommand: AppBinding = {
    app_id: 'jira',
    label: 'view',
    location: '/command/jira/issue/view',
    description: 'View details of a Jira issue',
    form: {
        submit: {
            path: '/view-issue',
        },
        fields: [
            {
                name: 'project',
                label: 'project',
                description: 'The Jira project description',
                type: AppFieldTypes.DYNAMIC_SELECT,
                hint: 'The Jira project hint',
                is_required: true,
                lookup: {
                    path: '/view-issue-lookup',
                },
            },
            {
                name: 'issue',
                position: 1,
                description: 'The Jira issue key',
                type: AppFieldTypes.TEXT,
                hint: 'MM-11343',
                is_required: true,
            },
        ],
    } as AppForm,
};

export const createCommand: AppBinding = {
    app_id: 'jira',
    label: 'create',
    location: '/command/jira/issue/create',
    description: 'Create a new Jira issue',
    icon: 'Create icon',
    hint: 'Create hint',
    form: {
        submit: {
            path: '/create-issue',
        },
        fields: [
            {
                name: 'project',
                label: 'project',
                description: 'The Jira project description',
                type: AppFieldTypes.DYNAMIC_SELECT,
                hint: 'The Jira project hint',
                lookup: {
                    path: '/create-issue-lookup',
                },
            },
            {
                name: 'summary',
                label: 'summary',
                description: 'The Jira issue summary',
                type: AppFieldTypes.TEXT,
                hint: 'The thing is working great!',
            },
            {
                name: 'verbose',
                label: 'verbose',
                description: 'display details',
                type: AppFieldTypes.BOOL,
                hint: 'yes or no!',
            },
            {
                name: 'epic',
                label: 'epic',
                description: 'The Jira epic',
                type: AppFieldTypes.STATIC_SELECT,
                hint: 'The thing is working great!',
                options: [
                    {
                        label: 'Dylan Epic',
                        value: 'epic1',
                    },
                    {
                        label: 'Michael Epic',
                        value: 'epic2',
                    },
                ],
            },
        ],
    } as AppForm,
};

export const restCommand: AppBinding = {
    app_id: 'jira',
    label: 'rest',
    location: 'rest',
    description: 'rest description',
    icon: 'rest icon',
    hint: 'rest hint',
    form: {
        submit: {
            path: '/create-issue',
        },
        fields: [
            {
                name: 'summary',
                label: 'summary',
                description: 'The Jira issue summary',
                type: AppFieldTypes.TEXT,
                hint: 'The thing is working great!',
                position: -1,
            },
            {
                name: 'verbose',
                label: 'verbose',
                description: 'display details',
                type: AppFieldTypes.BOOL,
                hint: 'yes or no!',
            },
        ],
    } as AppForm,
};

export const testBindings: AppBinding[] = [
    {
        app_id: '',
        label: '',
        location: '/command',
        bindings: [
            {
                location: '/command/jira',
                app_id: 'jira',
                label: 'jira',
                description: 'Interact with your Jira instance',
                icon: 'Jira icon',
                hint: 'Jira hint',
                bindings: [{
                    location: '/command/jira/issue',
                    app_id: 'jira',
                    label: 'issue',
                    description: 'Interact with Jira issues',
                    icon: 'Issue icon',
                    hint: 'Issue hint',
                    bindings: [
                        viewCommand,
                        createCommand,
                        restCommand,
                    ],
                }],
            },
            {
                location: '/command/other',
                app_id: 'other',
                label: 'other',
                description: 'Other description',
                icon: 'Other icon',
                hint: 'Other hint',
                bindings: [{
                    location: '/command/other/sub1',
                    app_id: 'other',
                    label: 'sub1',
                    description: 'Some Description',
                    form: {
                        submit: {
                            path: '/submit_other',
                        },
                        fields: [{
                            name: 'fieldname',
                            label: 'fieldlabel',
                            description: 'field description',
                            type: AppFieldTypes.TEXT,
                            hint: 'field hint',
                        }],
                    },
                }],
            },
        ],
    },
];
