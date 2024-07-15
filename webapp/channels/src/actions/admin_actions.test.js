// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as Actions from 'actions/admin_actions.jsx';
import configureStore from 'store';

describe('Actions.Admin', () => {
    let store;
    beforeEach(async () => {
        store = await configureStore();
    });

    test('Register a plugin adds the plugin to the state', async () => {
        const func = jest.fn();
        expect(store.getState().plugins.adminConsoleReducers).toEqual({});
        store.dispatch(Actions.registerAdminConsolePlugin('plugin-id', func));
        expect(store.getState().plugins.adminConsoleReducers).toEqual({'plugin-id': func});
    });

    test('Unregister a plugin removes an existing plugin from the state', async () => {
        const func = jest.fn();
        expect(store.getState().plugins.adminConsoleReducers).toEqual({});
        store.dispatch(Actions.registerAdminConsolePlugin('plugin-id', func));
        expect(store.getState().plugins.adminConsoleReducers).toEqual({'plugin-id': func});

        store.dispatch(Actions.unregisterAdminConsolePlugin('plugin-id'));
        expect(store.getState().plugins.adminConsoleReducers).toEqual({});
    });

    test('Unregister an unexisting plugin do nothing', async () => {
        const func = jest.fn();
        expect(store.getState().plugins.adminConsoleReducers).toEqual({});
        store.dispatch(Actions.registerAdminConsolePlugin('plugin-id', func));
        expect(store.getState().plugins.adminConsoleReducers).toEqual({'plugin-id': func});

        store.dispatch(Actions.unregisterAdminConsolePlugin('invalid-plugin-id'));
        expect(store.getState().plugins.adminConsoleReducers).toEqual({'plugin-id': func});
    });

    test('Register a custom plugin setting adds the component to the state', async () => {
        expect(store.getState().plugins.adminConsoleCustomComponents).toEqual({});

        store.dispatch(Actions.registerAdminConsoleCustomSetting('plugin-id', 'settingA', React.Component, {showTitle: true}));
        expect(store.getState().plugins.adminConsoleCustomComponents).toEqual(
            {'plugin-id': {
                settinga: {
                    key: 'settingA',
                    pluginId: 'plugin-id',
                    component: React.Component,
                    options: {
                        showTitle: true,
                    },
                }}});
    });

    test('Register a custom plugin section adds the component to the state', async () => {
        expect(store.getState().plugins.adminConsoleCustomSections).toEqual({});

        store.dispatch(Actions.registerAdminConsoleCustomSection('plugin-id', 'sectionA', React.Component));
        expect(store.getState().plugins.adminConsoleCustomSections).toEqual(
            {'plugin-id': {
                sectiona: {
                    key: 'sectionA',
                    pluginId: 'plugin-id',
                    component: React.Component,
                }}});
    });
});
