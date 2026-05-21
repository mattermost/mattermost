// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';
import React from 'react';

import {Client4} from 'mattermost-redux/client';

import * as Actions from 'actions/admin_actions.jsx';
import configureStore from 'store';

Client4.setUrl('http://localhost:8065');

describe('Actions.Admin', () => {
    let store;
    beforeEach(async () => {
        store = await configureStore();
        nock.cleanAll();
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

    test('testS3Connection forwards the provided config to the server', async () => {
        const config = {FileSettings: {AmazonS3AccessKeyId: 'pending-key', AmazonS3SecretAccessKey: 'pending-secret'}};
        const success = jest.fn();
        const error = jest.fn();

        const scope = nock(Client4.getBaseRoute()).
            post('/file/s3_test', config).
            reply(200, {status: 'OK'});

        await Actions.testS3Connection(success, error, config);

        expect(scope.isDone()).toBe(true);
        expect(success).toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
    });

    test('testSmtp forwards the provided config to the server', async () => {
        const config = {EmailSettings: {SMTPServer: 'smtp.pending.example', SMTPUsername: 'pending-user'}};
        const success = jest.fn();
        const error = jest.fn();

        const scope = nock(Client4.getBaseRoute()).
            post('/email/test', config).
            reply(200, {status: 'OK'});

        await Actions.testSmtp(success, error, config);

        expect(scope.isDone()).toBe(true);
        expect(success).toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
    });

    test('testS3Connection invokes the error callback when the server returns an error', async () => {
        const config = {FileSettings: {AmazonS3AccessKeyId: 'bad-key'}};
        const success = jest.fn();
        const error = jest.fn();

        const scope = nock(Client4.getBaseRoute()).
            post('/file/s3_test', config).
            reply(500, {id: 'api.file.test_connection_s3.app_error', message: 'Connection failed'});

        await Actions.testS3Connection(success, error, config);

        expect(scope.isDone()).toBe(true);
        expect(error).toHaveBeenCalled();
        expect(success).not.toHaveBeenCalled();
    });

    test('testSmtp invokes the error callback when the server returns an error', async () => {
        const config = {EmailSettings: {SMTPServer: 'invalid.smtp'}};
        const success = jest.fn();
        const error = jest.fn();

        const scope = nock(Client4.getBaseRoute()).
            post('/email/test', config).
            reply(400, {id: 'api.admin.test_email.app_error', message: 'Invalid SMTP config'});

        await Actions.testSmtp(success, error, config);

        expect(scope.isDone()).toBe(true);
        expect(error).toHaveBeenCalled();
        expect(success).not.toHaveBeenCalled();
    });
});
