// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AppBinding} from '@mattermost/types/apps';

import {AppsTypes} from 'mattermost-redux/action_types';

import * as Reducers from './apps';

describe('bindings', () => {
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
