// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AppBinding, AppForm} from '@mattermost/types/apps';

import {AppsTypes} from 'mattermost-redux/action_types';

import * as Reducers from './apps';

describe('bindings', () => {
    const initialState: AppBinding[] = [];
    const basicSubmitForm: AppForm = {
        submit: {
            path: '/submit_url',
        },
    };
    test('No element get filtered', () => {
        const data = [
            {
                app_id: '1',
                location: '/post_menu',
                bindings: [
                    {
                        location: 'locA',
                        label: 'a',
                        form: basicSubmitForm,
                    },
                ],
            },
            {
                app_id: '2',
                location: '/post_menu',
                bindings: [
                    {
                        location: 'locA',
                        label: 'a',
                        form: basicSubmitForm,
                    },
                ],
            },
            {
                app_id: '1',
                location: '/channel_header',
                bindings: [
                    {
                        location: 'locB',
                        label: 'b',
                        icon: 'icon',
                        form: basicSubmitForm,
                    },
                ],
            },
            {
                app_id: '3',
                location: '/command',
                bindings: [
                    {
                        location: 'locC',
                        label: 'c',
                        form: basicSubmitForm,
                    },
                ],
            },
        ];

        const state = Reducers.mainBindings(
            initialState,
            {
                type: AppsTypes.RECEIVED_APP_BINDINGS,
                data,
            },
        );

        expect(state).toMatchSnapshot();
    });

    test('Invalid channel header get filtered', () => {
        const data = [
            {
                app_id: '1',
                location: '/post_menu',
                bindings: [
                    {
                        location: 'locA',
                        label: 'a',
                        form: basicSubmitForm,
                    },
                ],
            },
            {
                app_id: '2',
                location: '/post_menu',
                bindings: [
                    {
                        location: 'locA',
                        label: 'a',
                        form: basicSubmitForm,
                    },
                ],
            },
            {
                app_id: '1',
                location: '/channel_header',
                bindings: [
                    {
                        location: 'locB',
                        label: 'b',
                        icon: 'icon',
                        form: basicSubmitForm,
                    },
                    {
                        location: 'locC',
                        label: 'c',
                        form: basicSubmitForm,
                    },
                ],
            },
            {
                app_id: '2',
                location: '/channel_header',
                bindings: [
                    {
                        icon: 'icon',
                        form: basicSubmitForm,
                    },
                    {
                        location: 'locC',
                        label: 'c',
                        icon: 'icon',
                        form: basicSubmitForm,
                    },
                ],
            },
            {
                app_id: '3',
                location: '/channel_header',
                bindings: [
                    {
                        location: 'locB',
                        form: basicSubmitForm,
                    },
                    {
                        location: 'locC',
                        label: 'c',
                        form: basicSubmitForm,
                    },
                ],
            },
            {
                app_id: '3',
                location: '/command',
                bindings: [
                    {
                        location: 'locC',
                        label: 'c',
                        form: basicSubmitForm,
                    },
                ],
            },
        ];

        const state = Reducers.mainBindings(
            initialState,
            {
                type: AppsTypes.RECEIVED_APP_BINDINGS,
                data,
            },
        );

        expect(state).toMatchSnapshot();
    });

    test('Invalid post menu get filtered', () => {
        const data = [
            {
                app_id: '1',
                location: '/post_menu',
                bindings: [
                    {
                        form: basicSubmitForm,
                    },
                    {
                        location: 'locB',
                        label: 'a',
                        form: basicSubmitForm,
                    },
                ],
            },
            {
                app_id: '2',
                location: '/post_menu',
                bindings: [
                    {
                        location: 'locA',
                        label: 'a',
                        form: basicSubmitForm,
                    },
                    {
                        location: 'locB',
                        label: 'b',
                        form: basicSubmitForm,
                    },
                ],
            },
            {
                app_id: '3',
                location: '/post_menu',
                bindings: [
                    {
                        form: basicSubmitForm,
                    },
                ],
            },
            {
                app_id: '1',
                location: '/channel_header',
                bindings: [
                    {
                        location: 'locB',
                        label: 'b',
                        icon: 'icon',
                        form: basicSubmitForm,
                    },
                ],
            },
            {
                app_id: '3',
                location: '/command',
                bindings: [
                    {
                        location: 'locC',
                        label: 'c',
                        form: basicSubmitForm,
                    },
                ],
            },
        ];

        const state = Reducers.mainBindings(
            initialState,
            {
                type: AppsTypes.RECEIVED_APP_BINDINGS,
                data,
            },
        );

        expect(state).toMatchSnapshot();
    });

    test('Invalid commands get filtered', () => {
        const data = [
            {
                app_id: '1',
                location: '/post_menu',
                bindings: [
                    {
                        location: 'locA',
                        label: 'a',
                        form: basicSubmitForm,
                    },
                    {
                        location: 'locB',
                        label: 'a',
                        form: basicSubmitForm,
                    },
                ],
            },
            {
                app_id: '1',
                location: '/channel_header',
                bindings: [
                    {
                        location: 'locB',
                        label: 'b',
                        icon: 'icon',
                        form: basicSubmitForm,
                    },
                ],
            },
            {
                app_id: '3',
                location: '/command',
                bindings: [
                    {
                        location: 'locC',
                        label: 'c',
                        bindings: [
                            {
                                form: basicSubmitForm,
                            },
                            {
                                location: 'subC2',
                                label: 'c2',
                                form: basicSubmitForm,
                            },
                        ],
                    },
                    {
                        location: 'locD',
                        label: 'd',
                        bindings: [
                            {
                                form: basicSubmitForm,
                            },
                        ],
                    },
                ],
            },
            {
                app_id: '1',
                location: '/command',
                bindings: [
                    {
                        form: basicSubmitForm,
                    },
                ],
            },
            {
                app_id: '2',
                location: '/command',
                bindings: [
                    {
                        location: 'locC',
                        label: 'c',
                        bindings: [
                            {
                                location: 'subC1',
                                label: 'c1',
                                form: basicSubmitForm,
                            },
                            {
                                location: 'subC2',
                                label: 'c2',
                                form: basicSubmitForm,
                            },
                        ],
                    },
                ],
            },
        ];

        const state = Reducers.mainBindings(
            initialState,
            {
                type: AppsTypes.RECEIVED_APP_BINDINGS,
                data,
            },
        );

        expect(state).toMatchSnapshot();
    });

    test('Apps plugin gets disabled', () => {
        const initialState: AppBinding[] = [
            {
                app_id: '1',
                location: '/post_menu',
                label: 'post_menu',
                bindings: [
                    {
                        app_id: '1',
                        location: 'locA',
                        label: 'a',
                    },
                ],
            },
        ] as AppBinding[];

        const state = Reducers.mainBindings(
            initialState,
            {
                type: AppsTypes.APPS_PLUGIN_DISABLED,
            },
        );

        expect(state).toEqual([]);
    });
});

describe('pluginEnabled', () => {
    test('Apps plugin gets enabled', () => {
        let state = Reducers.pluginEnabled(
            true,
            {
                type: AppsTypes.APPS_PLUGIN_ENABLED,
            },
        );

        expect(state).toBe(true);

        state = Reducers.pluginEnabled(
            false,
            {
                type: AppsTypes.APPS_PLUGIN_ENABLED,
            },
        );

        expect(state).toBe(true);
    });

    test('Apps plugin gets disabled', () => {
        let state = Reducers.pluginEnabled(
            true,
            {
                type: AppsTypes.APPS_PLUGIN_DISABLED,
            },
        );

        expect(state).toBe(false);

        state = Reducers.pluginEnabled(
            false,
            {
                type: AppsTypes.APPS_PLUGIN_DISABLED,
            },
        );

        expect(state).toBe(false);
    });

    test('Apps plugin gets disabled', () => {
        let state = Reducers.pluginEnabled(
            true,
            {
                type: AppsTypes.APPS_PLUGIN_DISABLED,
            },
        );

        expect(state).toBe(false);

        state = Reducers.pluginEnabled(
            false,
            {
                type: AppsTypes.APPS_PLUGIN_DISABLED,
            },
        );

        expect(state).toBe(false);
    });

    test('Apps plugin gets disabled', () => {
        let state = Reducers.pluginEnabled(
            true,
            {
                type: AppsTypes.APPS_PLUGIN_DISABLED,
            },
        );

        expect(state).toBe(false);

        state = Reducers.pluginEnabled(
            false,
            {
                type: AppsTypes.APPS_PLUGIN_DISABLED,
            },
        );

        expect(state).toBe(false);
    });

    test('Bindings are succesfully fetched', () => {
        let state = Reducers.pluginEnabled(
            true,
            {
                type: AppsTypes.RECEIVED_APP_BINDINGS,
            },
        );

        expect(state).toBe(true);

        state = Reducers.pluginEnabled(
            false,
            {
                type: AppsTypes.RECEIVED_APP_BINDINGS,
            },
        );

        expect(state).toBe(true);
    });

    test('Bindings fail to fetch', () => {
        let state = Reducers.pluginEnabled(
            true,
            {
                type: AppsTypes.FAILED_TO_FETCH_APP_BINDINGS,
            },
        );

        expect(state).toBe(false);

        state = Reducers.pluginEnabled(
            false,
            {
                type: AppsTypes.FAILED_TO_FETCH_APP_BINDINGS,
            },
        );

        expect(state).toBe(false);
    });
});
