// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LogLevelEnum} from '@mattermost/types/admin';
import type {LogObject} from '@mattermost/types/admin';

import {AdminTypes, UserTypes} from 'mattermost-redux/action_types';
import PluginState from 'mattermost-redux/constants/plugins';
import reducer, {convertAnalyticsRowsToStats} from 'mattermost-redux/reducers/entities/admin';
import deepFreezeAndThrowOnMutation from 'mattermost-redux/utils/deep_freeze';

type ReducerState = ReturnType<typeof reducer>;

describe('reducers.entities.admin', () => {
    describe('pluginStatuses', () => {
        it('initial state', () => {
            const state = {};
            const action = {type: 'testinit'};
            const expectedState = {};

            const actualState = reducer({pluginStatuses: state} as ReducerState, action);
            expect(actualState.pluginStatuses).toEqual(expectedState);
        });

        it('RECEIVED_PLUGIN_STATUSES, empty initial state', () => {
            const state = {};
            const action = {
                type: AdminTypes.RECEIVED_PLUGIN_STATUSES,
                data: [
                    {
                        plugin_id: 'plugin_0',
                        cluster_id: 'cluster_id_1',
                        version: '0.1.0',
                        state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                        error: 'some error',
                        name: 'Plugin 0',
                        description: 'The plugin 0.',
                    },
                    {
                        plugin_id: 'plugin_1',
                        cluster_id: 'cluster_id_1',
                        version: '0.0.1',
                        state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                        error: '',
                        name: 'Plugin 1',
                        description: 'The plugin.',
                    },
                    {
                        plugin_id: 'plugin_1',
                        cluster_id: 'cluster_id_2',
                        version: '0.0.2',
                        state: PluginState.PLUGIN_STATE_RUNNING,
                        error: '',
                        name: 'Plugin 1',
                        description: 'The plugin, different description.',
                    },
                ],
            };
            const expectedState = {
                plugin_0: {
                    id: 'plugin_0',
                    version: '0.1.0',
                    state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                    error: 'some error',
                    name: 'Plugin 0',
                    description: 'The plugin 0.',
                    active: false,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.1.0',
                        },
                    ],
                },
                plugin_1: {
                    id: 'plugin_1',
                    version: '0.0.1',
                    state: PluginState.PLUGIN_STATE_RUNNING,
                    error: '',
                    name: 'Plugin 1',
                    description: 'The plugin.',
                    active: true,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.0.1',
                        },
                        {
                            cluster_id: 'cluster_id_2',
                            state: PluginState.PLUGIN_STATE_RUNNING,
                            version: '0.0.2',
                        },
                    ],
                },
            };

            const actualState = reducer({pluginStatuses: state} as ReducerState, action);
            expect(actualState.pluginStatuses).toEqual(expectedState);
        });

        it('RECEIVED_PLUGIN_STATUSES, previously populated state', () => {
            const state = {
                plugin_0: {
                    id: 'plugin_0',
                    version: '0.1.0-old',
                    state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                    error: 'existing error',
                    name: 'Plugin 0 - old',
                    description: 'The plugin 0 - old.',
                    active: false,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.1.0',
                        },
                    ],
                },
                plugin_1: {
                    id: 'plugin_1',
                    version: '0.0.1',
                    state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                    error: '',
                    name: 'Plugin 1',
                    description: 'The plugin.',
                    active: false,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.0.1',
                        },
                    ],
                },
            };
            const action = {
                type: AdminTypes.RECEIVED_PLUGIN_STATUSES,
                data: [
                    {
                        plugin_id: 'plugin_0',
                        cluster_id: 'cluster_id_1',
                        version: '0.1.0',
                        state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                        error: '',
                        name: 'Plugin 0',
                        description: 'The plugin 0.',
                    },
                    {
                        plugin_id: 'plugin_1',
                        cluster_id: 'cluster_id_1',
                        version: '0.0.1',
                        state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                        error: '',
                        name: 'Plugin 1',
                        description: 'The plugin.',
                    },
                    {
                        plugin_id: 'plugin_1',
                        cluster_id: 'cluster_id_2',
                        version: '0.0.2',
                        state: PluginState.PLUGIN_STATE_RUNNING,
                        error: '',
                        name: 'Plugin 1',
                        description: 'The plugin, different description.',
                    },
                ],
            };
            const expectedState = {
                plugin_0: {
                    id: 'plugin_0',
                    version: '0.1.0',
                    state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                    error: '',
                    name: 'Plugin 0',
                    description: 'The plugin 0.',
                    active: false,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.1.0',
                        },
                    ],
                },
                plugin_1: {
                    id: 'plugin_1',
                    version: '0.0.1',
                    state: PluginState.PLUGIN_STATE_RUNNING,
                    error: '',
                    name: 'Plugin 1',
                    description: 'The plugin.',
                    active: true,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.0.1',
                        },
                        {
                            cluster_id: 'cluster_id_2',
                            state: PluginState.PLUGIN_STATE_RUNNING,
                            version: '0.0.2',
                        },
                    ],
                },
            };

            const actualState = reducer({pluginStatuses: state} as ReducerState, action);
            expect(actualState.pluginStatuses).toEqual(expectedState);
        });

        it('ENABLE_PLUGIN_REQUEST, plugin_0', () => {
            const state = {
                plugin_0: {
                    id: 'plugin_0',
                    version: '0.1.0',
                    state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                    name: 'Plugin 0',
                    description: 'The plugin 0.',
                    active: false,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.1.0',
                        },
                    ],
                },
                plugin_1: {
                    id: 'plugin_1',
                    version: '0.0.1',
                    state: PluginState.PLUGIN_STATE_RUNNING,
                    name: 'Plugin 1',
                    description: 'The plugin.',
                    active: true,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.0.1',
                        },
                        {
                            cluster_id: 'cluster_id_2',
                            state: PluginState.PLUGIN_STATE_RUNNING,
                            version: '0.0.2',
                        },
                    ],
                },
            };
            const action = {
                type: AdminTypes.ENABLE_PLUGIN_REQUEST,
                data: 'plugin_0',
            };
            const expectedState = {
                plugin_0: {
                    id: 'plugin_0',
                    version: '0.1.0',
                    state: PluginState.PLUGIN_STATE_STARTING,
                    name: 'Plugin 0',
                    description: 'The plugin 0.',
                    active: false,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.1.0',
                        },
                    ],
                },
                plugin_1: {
                    id: 'plugin_1',
                    version: '0.0.1',
                    state: PluginState.PLUGIN_STATE_RUNNING,
                    name: 'Plugin 1',
                    description: 'The plugin.',
                    active: true,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.0.1',
                        },
                        {
                            cluster_id: 'cluster_id_2',
                            state: PluginState.PLUGIN_STATE_RUNNING,
                            version: '0.0.2',
                        },
                    ],
                },
            };

            const actualState = reducer({pluginStatuses: state} as ReducerState, action);
            expect(actualState.pluginStatuses).toEqual(expectedState);
        });

        it('DISABLE_PLUGIN_REQUEST, plugin_0', () => {
            const state = {
                plugin_0: {
                    id: 'plugin_0',
                    version: '0.1.0',
                    state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                    name: 'Plugin 0',
                    description: 'The plugin 0.',
                    active: false,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.1.0',
                        },
                    ],
                },
                plugin_1: {
                    id: 'plugin_1',
                    version: '0.0.1',
                    state: PluginState.PLUGIN_STATE_RUNNING,
                    name: 'Plugin 1',
                    description: 'The plugin.',
                    active: true,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.0.1',
                        },
                        {
                            cluster_id: 'cluster_id_2',
                            state: PluginState.PLUGIN_STATE_RUNNING,
                            version: '0.0.2',
                        },
                    ],
                },
            };
            const action = {
                type: AdminTypes.DISABLE_PLUGIN_REQUEST,
                data: 'plugin_0',
            };
            const expectedState = {
                plugin_0: {
                    id: 'plugin_0',
                    version: '0.1.0',
                    state: PluginState.PLUGIN_STATE_STOPPING,
                    name: 'Plugin 0',
                    description: 'The plugin 0.',
                    active: false,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.1.0',
                        },
                    ],
                },
                plugin_1: {
                    id: 'plugin_1',
                    version: '0.0.1',
                    state: PluginState.PLUGIN_STATE_RUNNING,
                    name: 'Plugin 1',
                    description: 'The plugin.',
                    active: true,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.0.1',
                        },
                        {
                            cluster_id: 'cluster_id_2',
                            state: PluginState.PLUGIN_STATE_RUNNING,
                            version: '0.0.2',
                        },
                    ],
                },
            };

            const actualState = reducer({pluginStatuses: state} as ReducerState, action);
            expect(actualState.pluginStatuses).toEqual(expectedState);
        });

        it('DISABLE_PLUGIN_REQUEST, plugin_1', () => {
            const state = {
                plugin_0: {
                    id: 'plugin_0',
                    version: '0.1.0',
                    state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                    name: 'Plugin 0',
                    description: 'The plugin 0.',
                    active: false,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.1.0',
                        },
                    ],
                },
                plugin_1: {
                    id: 'plugin_1',
                    version: '0.0.1',
                    state: PluginState.PLUGIN_STATE_RUNNING,
                    name: 'Plugin 1',
                    description: 'The plugin.',
                    active: true,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.0.1',
                        },
                        {
                            cluster_id: 'cluster_id_2',
                            state: PluginState.PLUGIN_STATE_RUNNING,
                            version: '0.0.2',
                        },
                    ],
                },
            };
            const action = {
                type: AdminTypes.DISABLE_PLUGIN_REQUEST,
                data: 'plugin_1',
            };
            const expectedState = {
                plugin_0: {
                    id: 'plugin_0',
                    version: '0.1.0',
                    state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                    name: 'Plugin 0',
                    description: 'The plugin 0.',
                    active: false,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.1.0',
                        },
                    ],
                },
                plugin_1: {
                    id: 'plugin_1',
                    version: '0.0.1',
                    state: PluginState.PLUGIN_STATE_STOPPING,
                    name: 'Plugin 1',
                    description: 'The plugin.',
                    active: true,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.0.1',
                        },
                        {
                            cluster_id: 'cluster_id_2',
                            state: PluginState.PLUGIN_STATE_RUNNING,
                            version: '0.0.2',
                        },
                    ],
                },
            };

            const actualState = reducer({pluginStatuses: state} as ReducerState, action);
            expect(actualState.pluginStatuses).toEqual(expectedState);
        });

        it('REMOVED_PLUGIN, plugin_0', () => {
            const state = {
                plugin_0: {
                    id: 'plugin_0',
                    version: '0.1.0-old',
                    state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                    name: 'Plugin 0 - old',
                    description: 'The plugin 0 - old.',
                    active: false,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.1.0',
                        },
                    ],
                },
                plugin_1: {
                    id: 'plugin_1',
                    version: '0.0.1',
                    state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                    name: 'Plugin 1',
                    description: 'The plugin.',
                    active: false,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.0.1',
                        },
                    ],
                },
            };
            const action = {
                type: AdminTypes.REMOVED_PLUGIN,
                data: 'plugin_0',
            };
            const expectedState = {
                plugin_1: {
                    id: 'plugin_1',
                    version: '0.0.1',
                    state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                    name: 'Plugin 1',
                    description: 'The plugin.',
                    active: false,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.0.1',
                        },
                    ],
                },
            };

            const actualState = reducer({pluginStatuses: state} as ReducerState, action);
            expect(actualState.pluginStatuses).toEqual(expectedState);
        });

        it('REMOVED_PLUGIN, plugin_1', () => {
            const state = {
                plugin_1: {
                    id: 'plugin_1',
                    version: '0.0.1',
                    state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                    name: 'Plugin 1',
                    description: 'The plugin.',
                    active: false,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.0.1',
                        },
                    ],
                },
            };
            const action = {
                type: AdminTypes.REMOVED_PLUGIN,
                data: 'plugin_1',
            };
            const expectedState = {};

            const actualState = reducer({pluginStatuses: state} as ReducerState, action);
            expect(actualState.pluginStatuses).toEqual(expectedState);
        });

        it('LOGOUT_SUCCESS, previously populated state', () => {
            const state = {
                plugin_0: {
                    id: 'plugin_0',
                    version: '0.1.0-old',
                    state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                    name: 'Plugin 0 - old',
                    description: 'The plugin 0 - old.',
                    active: false,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.1.0',
                        },
                    ],
                },
                plugin_1: {
                    id: 'plugin_1',
                    version: '0.0.1',
                    state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                    name: 'Plugin 1',
                    description: 'The plugin.',
                    active: false,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.0.1',
                        },
                    ],
                },
            };
            const action = {
                type: UserTypes.LOGOUT_SUCCESS,
            };
            const expectedState = {};

            const actualState = reducer({pluginStatuses: state} as ReducerState, action);
            expect(actualState.pluginStatuses).toEqual(expectedState);
        });
    });

    describe('convertAnalyticsRowsToStats', () => {
        it('data should not be mutated', () => {
            const data = deepFreezeAndThrowOnMutation([{name: '1', value: 1}, {name: '2', value: 2}, {name: '3', value: 3}]);
            convertAnalyticsRowsToStats(data, 'post_counts_day');
            convertAnalyticsRowsToStats(data, 'bot_post_counts_day');
        });
    });

    describe('ldapGroups', () => {
        it('initial state', () => {
            const state = {};
            const action = {type: 'testinit'};
            const expectedState = {};

            const actualState = reducer({ldapGroups: state} as ReducerState, action);
            expect(actualState.ldapGroups).toEqual(expectedState);
        });

        it('RECEIVED_LDAP_GROUPS, empty initial state', () => {
            const state = {};
            const action = {
                type: AdminTypes.RECEIVED_LDAP_GROUPS,
                data: {
                    count: 2,
                    groups: [
                        {
                            primary_key: 'test1',
                            name: 'test1',
                            mattermost_group_id: null,
                            has_syncables: null,
                        },
                        {
                            primary_key: 'test2',
                            name: 'test2',
                            mattermost_group_id: 'mattermost-id',
                            has_syncables: true,
                        },
                    ],
                },
            };
            const expectedState = {
                test1: {
                    primary_key: 'test1',
                    name: 'test1',
                    mattermost_group_id: null,
                    has_syncables: null,
                },
                test2: {
                    primary_key: 'test2',
                    name: 'test2',
                    mattermost_group_id: 'mattermost-id',
                    has_syncables: true,
                },
            };

            const actualState = reducer({ldapGroups: state} as ReducerState, action);
            expect(actualState.ldapGroups).toEqual(expectedState);
        });

        it('RECEIVED_LDAP_GROUPS, previously populated', () => {
            const state = {
                test1: {
                    primary_key: 'test1',
                    name: 'test1',
                    mattermost_group_id: null,
                    has_syncables: null,
                },
                test2: {
                    primary_key: 'test2',
                    name: 'test2',
                    mattermost_group_id: 'mattermost-id',
                    has_syncables: true,
                },
            };
            const action = {
                type: AdminTypes.RECEIVED_LDAP_GROUPS,
                data: {
                    count: 2,
                    groups: [
                        {
                            primary_key: 'test3',
                            name: 'test3',
                            mattermost_group_id: null,
                            has_syncables: null,
                        },
                        {
                            primary_key: 'test4',
                            name: 'test4',
                            mattermost_group_id: 'mattermost-id',
                            has_syncables: false,
                        },
                    ],
                },
            };
            const expectedState = {
                test3: {
                    primary_key: 'test3',
                    name: 'test3',
                    mattermost_group_id: null,
                    has_syncables: null,
                },
                test4: {
                    primary_key: 'test4',
                    name: 'test4',
                    mattermost_group_id: 'mattermost-id',
                    has_syncables: false,
                },
            };

            const actualState = reducer({ldapGroups: state} as ReducerState, action);
            expect(actualState.ldapGroups).toEqual(expectedState);
        });

        it('LINKED_LDAP_GROUP', () => {
            const state = {
                test1: {
                    primary_key: 'test1',
                    name: 'test1',
                    mattermost_group_id: null,
                    has_syncables: null,
                },
                test2: {
                    primary_key: 'test2',
                    name: 'test2',
                    mattermost_group_id: 'mattermost-id',
                    has_syncables: true,
                },
            };
            const action = {
                type: AdminTypes.LINKED_LDAP_GROUP,
                data: {
                    primary_key: 'test1',
                    name: 'test1',
                    mattermost_group_id: 'new-mattermost-id',
                    has_syncables: false,
                },
            };
            const expectedState = {
                test1: {
                    primary_key: 'test1',
                    name: 'test1',
                    mattermost_group_id: 'new-mattermost-id',
                    has_syncables: false,
                },
                test2: {
                    primary_key: 'test2',
                    name: 'test2',
                    mattermost_group_id: 'mattermost-id',
                    has_syncables: true,
                },
            };

            const actualState = reducer({ldapGroups: state} as ReducerState, action);
            expect(actualState.ldapGroups).toEqual(expectedState);
        });

        it('UNLINKED_LDAP_GROUP', () => {
            const state = {
                test1: {
                    primary_key: 'test1',
                    name: 'test1',
                    mattermost_group_id: null,
                    has_syncables: null,
                },
                test2: {
                    primary_key: 'test2',
                    name: 'test2',
                    mattermost_group_id: 'mattermost-id',
                    has_syncables: true,
                },
            };
            const action = {
                type: AdminTypes.UNLINKED_LDAP_GROUP,
                data: 'test2',
            };
            const expectedState = {
                test1: {
                    primary_key: 'test1',
                    name: 'test1',
                    mattermost_group_id: null,
                    has_syncables: null,
                },
                test2: {
                    primary_key: 'test2',
                    name: 'test2',
                    mattermost_group_id: undefined,
                    has_syncables: undefined,
                    failed: false,
                },
            };

            const actualState = reducer({ldapGroups: state} as ReducerState, action);
            expect(actualState.ldapGroups).toEqual(expectedState);
        });

        it('LINK_LDAP_GROUP_FAILURE', () => {
            const state = {
                test1: {
                    primary_key: 'test1',
                    name: 'test1',
                    mattermost_group_id: null,
                    has_syncables: null,
                },
                test2: {
                    primary_key: 'test2',
                    name: 'test2',
                    mattermost_group_id: 'mattermost-id',
                    has_syncables: true,
                },
            };
            const action = {
                type: AdminTypes.LINK_LDAP_GROUP_FAILURE,
                data: 'test1',
            };
            const expectedState = {
                test1: {
                    primary_key: 'test1',
                    name: 'test1',
                    mattermost_group_id: null,
                    has_syncables: null,
                    failed: true,
                },
                test2: {
                    primary_key: 'test2',
                    name: 'test2',
                    mattermost_group_id: 'mattermost-id',
                    has_syncables: true,
                },
            };

            const actualState = reducer({ldapGroups: state} as ReducerState, action);
            expect(actualState.ldapGroups).toEqual(expectedState);
        });

        it('LINK_LDAP_GROUP_FAILURE', () => {
            const state = {
                test1: {
                    primary_key: 'test1',
                    name: 'test1',
                    mattermost_group_id: null,
                    has_syncables: null,
                },
                test2: {
                    primary_key: 'test2',
                    name: 'test2',
                    mattermost_group_id: 'mattermost-id',
                    has_syncables: true,
                },
            };
            const action = {
                type: AdminTypes.LINK_LDAP_GROUP_FAILURE,
                data: 'test2',
            };
            const expectedState = {
                test1: {
                    primary_key: 'test1',
                    name: 'test1',
                    mattermost_group_id: null,
                    has_syncables: null,
                },
                test2: {
                    primary_key: 'test2',
                    name: 'test2',
                    mattermost_group_id: 'mattermost-id',
                    has_syncables: true,
                    failed: true,
                },
            };

            const actualState = reducer({ldapGroups: state} as ReducerState, action);
            expect(actualState.ldapGroups).toEqual(expectedState);
        });
    });

    describe('Data Retention', () => {
        it('initial state', () => {
            const state = {};
            const action = {type: 'testinit'};
            const expectedState = {};

            const actualState = reducer({dataRetentionCustomPolicies: state} as ReducerState, action);
            expect(actualState.dataRetentionCustomPolicies).toEqual(expectedState);
        });

        it('RECEIVED_DATA_RETENTION_CUSTOM_POLICIES', () => {
            const state = {};
            const action = {
                type: AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICIES,
                data: {
                    policies: [
                        {
                            id: 'id1',
                            display_name: 'Test Policy',
                            post_duration: 100,
                            team_count: 2,
                            channel_count: 1,
                        },
                        {
                            id: 'id2',
                            display_name: 'Test Policy 2',
                            post_duration: 365,
                            team_count: 0,
                            channel_count: 9,
                        },
                    ],
                    total_count: 2,
                },
            };
            const expectedState = {
                id1: {
                    id: 'id1',
                    display_name: 'Test Policy',
                    post_duration: 100,
                    team_count: 2,
                    channel_count: 1,
                },
                id2: {
                    id: 'id2',
                    display_name: 'Test Policy 2',
                    post_duration: 365,
                    team_count: 0,
                    channel_count: 9,
                },
            };

            const actualState = reducer({dataRetentionCustomPolicies: state} as ReducerState, action);
            expect(actualState.dataRetentionCustomPolicies).toEqual(expectedState);
        });

        it('RECEIVED_DATA_RETENTION_CUSTOM_POLICY', () => {
            const state = {};
            const action = {
                type: AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY,
                data: {
                    id: 'id1',
                    display_name: 'Test Policy',
                    post_duration: 100,
                    team_count: 2,
                    channel_count: 1,
                },
            };
            const expectedState = {
                id1: {
                    id: 'id1',
                    display_name: 'Test Policy',
                    post_duration: 100,
                    team_count: 2,
                    channel_count: 1,
                },
            };

            const actualState = reducer({dataRetentionCustomPolicies: state} as ReducerState, action);
            expect(actualState.dataRetentionCustomPolicies).toEqual(expectedState);
        });

        it('DELETE_DATA_RETENTION_CUSTOM_POLICY_SUCCESS', () => {
            const state = {
                id1: {
                    id: 'id1',
                    display_name: 'Test Policy',
                    post_duration: 100,
                    team_count: 2,
                    channel_count: 1,
                },
            };
            const action = {
                type: AdminTypes.DELETE_DATA_RETENTION_CUSTOM_POLICY_SUCCESS,
                data: {
                    id: 'id1',
                },
            };
            const expectedState = {};

            const actualState = reducer({dataRetentionCustomPolicies: state} as unknown as ReducerState, action);
            expect(actualState.dataRetentionCustomPolicies).toEqual(expectedState);
        });

        it('CREATE_DATA_RETENTION_CUSTOM_POLICY_SUCCESS', () => {
            const state = {};
            const action = {
                type: AdminTypes.CREATE_DATA_RETENTION_CUSTOM_POLICY_SUCCESS,
                data: {
                    id: 'id1',
                    display_name: 'Test Policy',
                    post_duration: 100,
                    team_count: 2,
                    channel_count: 1,
                },
            };
            const expectedState = {
                id1: {
                    id: 'id1',
                    display_name: 'Test Policy',
                    post_duration: 100,
                    team_count: 2,
                    channel_count: 1,
                },
            };

            const actualState = reducer({dataRetentionCustomPolicies: state} as ReducerState, action);
            expect(actualState.dataRetentionCustomPolicies).toEqual(expectedState);
        });

        it('UPDATE_DATA_RETENTION_CUSTOM_POLICY_SUCCESS', () => {
            const state = {
                id1: {
                    id: 'id1',
                    display_name: 'Test Policy',
                    post_duration: 100,
                    team_count: 2,
                    channel_count: 1,
                },
            };
            const action = {
                type: AdminTypes.CREATE_DATA_RETENTION_CUSTOM_POLICY_SUCCESS,
                data: {
                    id: 'id1',
                    display_name: 'Test Policy 123',
                    post_duration: 365,
                    team_count: 2,
                    channel_count: 1,
                },
            };
            const expectedState = {
                id1: {
                    id: 'id1',
                    display_name: 'Test Policy 123',
                    post_duration: 365,
                    team_count: 2,
                    channel_count: 1,
                },
            };

            const actualState = reducer({dataRetentionCustomPolicies: state} as unknown as ReducerState, action);
            expect(actualState.dataRetentionCustomPolicies).toEqual(expectedState);
        });
    });

    describe('logs', () => {
        function makeLog(msg: string, timestamp: string, extra: Partial<LogObject> = {}): LogObject {
            return {caller: '', job_id: '', level: LogLevelEnum.INFO, msg, timestamp, worker: '', ...extra};
        }

        const t1 = '2026-10-28 10:00:01.000 Z';
        const t2 = '2026-10-28 10:00:02.000 Z';
        const t3 = '2026-10-28 10:00:03.000 Z';

        function receiveNewLogs(state: Record<string, LogObject[]>, data: Record<string, LogObject[]>) {
            return reducer(deepFreezeAndThrowOnMutation({logs: state}) as ReducerState, {type: AdminTypes.RECEIVED_NEW_LOGS, data}).logs;
        }

        it('RECEIVED_LOGS replaces every node', () => {
            const state = {'node-a': [makeLog('old', t1)], 'node-b': [makeLog('old', t1)]};
            const data = {'node-a': [makeLog('new', t2)]};

            const actual = reducer({logs: state} as unknown as ReducerState, {type: AdminTypes.RECEIVED_LOGS, data});

            expect(actual.logs).toBe(data);
        });

        it('RECEIVED_NEW_LOGS appends new entries and drops the repeated ones', () => {
            const a1 = makeLog('a1', t1);
            const a2 = makeLog('a2', t2);
            const a3 = makeLog('a3', t3);

            // Asked for entries from t2 onwards, so a2 comes back again
            const actual = receiveNewLogs({'node-a': [a1, a2]}, {'node-a': [{...a2}, a3]});

            expect(actual['node-a']).toEqual([a1, a2, a3]);
            expect(actual['node-a'][1]).toBe(a2);
        });

        it('RECEIVED_NEW_LOGS keeps an identical entry logged again in the same millisecond', () => {
            const entry = makeLog('same', t2);

            const actual = receiveNewLogs({'node-a': [entry]}, {'node-a': [{...entry}, {...entry}]});

            expect(actual['node-a']).toEqual([entry, entry]);
        });

        it('RECEIVED_NEW_LOGS drops everything a node that ignores the date filter sends again', () => {
            const existing = [makeLog('a1', t1), makeLog('a2', t2)];

            const actual = receiveNewLogs({'node-a': existing}, {'node-a': [...existing.map((log) => ({...log})), makeLog('a3', t3)]});

            expect(actual['node-a']).toEqual([...existing, makeLog('a3', t3)]);
        });

        it('RECEIVED_NEW_LOGS leaves the other nodes alone', () => {
            const nodeB = [makeLog('b1', t1)];

            const actual = receiveNewLogs({'node-a': [makeLog('a1', t1)], 'node-b': nodeB}, {'node-a': [makeLog('a2', t2)]});

            expect(actual['node-b']).toBe(nodeB);
            expect(actual['node-a']).toEqual([makeLog('a1', t1), makeLog('a2', t2)]);
        });

        it('RECEIVED_NEW_LOGS adds a node it has not seen', () => {
            const actual = receiveNewLogs({'node-a': []}, {'node-b': [makeLog('b1', t1)]});

            expect(actual).toEqual({'node-a': [], 'node-b': [makeLog('b1', t1)]});
        });

        it('RECEIVED_NEW_LOGS returns the same state when nothing is new', () => {
            const state = {'node-a': [makeLog('a1', t1), makeLog('a2', t2)]};

            const actual = receiveNewLogs(state, {'node-a': [makeLog('a2', t2)]});

            expect(actual).toBe(state);
        });

        it('RECEIVED_NEW_LOGS replaces a failed node entry instead of piling them up', () => {
            const failed = (timestamp: string) => makeLog('Failed to fetch logs from node', timestamp, {failed_node: true});
            const a1 = makeLog('a1', t1);

            const stillFailing = receiveNewLogs({'node-a': [a1, failed(t2)]}, {'node-a': [failed(t3)]});
            expect(stillFailing['node-a']).toEqual([a1, failed(t3)]);

            const recovered = receiveNewLogs({'node-a': [a1, failed(t2)]}, {'node-a': []});
            expect(recovered['node-a']).toEqual([a1]);
        });

        it('RECEIVED_NEW_LOGS keeps only the newest 10,000 entries per node', () => {
            const existing = Array.from({length: 10000}, (_, i) => makeLog(`old ${i}`, t1));

            const actual = receiveNewLogs({'node-a': existing}, {'node-a': [makeLog('new 1', t2), makeLog('new 2', t3)]});

            expect(actual['node-a']).toHaveLength(10000);
            expect(actual['node-a'][0].msg).toBe('old 2');
            expect(actual['node-a'].slice(-2).map((log) => log.msg)).toEqual(['new 1', 'new 2']);
        });

        it('LOGOUT_SUCCESS clears the entries', () => {
            const actual = reducer({logs: {'node-a': [makeLog('a1', t1)]}} as unknown as ReducerState, {type: UserTypes.LOGOUT_SUCCESS});

            expect(actual.logs).toEqual({});
        });
    });
});
