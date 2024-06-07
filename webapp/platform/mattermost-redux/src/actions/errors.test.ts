// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import {logError} from 'mattermost-redux/actions/errors';
import {Client4} from 'mattermost-redux/client';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

describe('Actions.Errors', () => {
    let store = configureStore();
    beforeAll(() => {
        TestHelper.initBasic(Client4);
        Client4.setEnableLogging(true);
    });

    beforeEach(() => {
        store = configureStore();
    });

    afterAll(() => {
        TestHelper.tearDown();
        Client4.setEnableLogging(false);
    });

    it('logError should hit /logs endpoint, unless server error', async () => {
        let count = 0;

        nock(Client4.getBaseRoute()).
            post('/logs').
            reply(200, () => {
                count++;
                return '{}';
            }).
            post('/logs').
            reply(200, () => {
                count++;
                return '{}';
            }).
            post('/logs').
            reply(200, () => {
                count++;
                return '{}';
            });

        await store.dispatch(logError({message: 'error'}));
        await store.dispatch(logError({message: 'error', server_error_id: 'error_id'}));
        await store.dispatch(logError({message: 'error'}));

        if (count > 2) {
            throw new Error(`should not hit /logs endpoint, called ${count} times`);
        }

        await store.dispatch(logError({message: 'error', server_error_id: 'api.context.session_expired.app_error'}));

        if (count > 2) {
            throw new Error('should not add session expired errors to the reducer');
        }
    });
});
