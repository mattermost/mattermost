// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import type {HealthFinding} from '@mattermost/types/health';

import * as Actions from 'mattermost-redux/actions/health';
import {Client4} from 'mattermost-redux/client';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

const finding: HealthFinding = {
    fingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    code: 'push_bad_scheme',
    subject: 'EmailSettings.PushNotificationServer',
    scope: '',
    severity: 'critical',
    state: 'firing',
    area: 'notifications',
    surface: 'product',
    title: 'Push notification server is not HTTPS',
    remediation: 'Set Push Notification Server to an https:// URL.',
    message: 'The push server uses http://.',
    message_id: 'health.rule.push_bad_scheme.message.http',
    first_seen_at: 1000,
    last_seen_at: 3000,
    state_since: 1000,
};

describe('Actions.Health', () => {
    let store = configureStore();

    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    beforeEach(() => {
        store = configureStore();
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    test('getHealthFindings stores the findings by fingerprint', async () => {
        nock(Client4.getBaseRoute()).
            get('/health/findings').
            reply(200, [finding]);

        const result = await store.dispatch(Actions.getHealthFindings());

        expect(result).toEqual({data: [finding]});
        expect(store.getState().entities.health.findings).toEqual({[finding.fingerprint]: finding});
    });

    test('getHealthFindings sends the muted filter as a query parameter', async () => {
        nock(Client4.getBaseRoute()).
            get('/health/findings').
            query({muted: 'only'}).
            reply(200, []);

        const result = await store.dispatch(Actions.getHealthFindings({muted: 'only'}));

        expect(result).toEqual({data: []});
    });

    test('getHealthFindings returns the error and keeps the store unchanged on failure', async () => {
        nock(Client4.getBaseRoute()).
            get('/health/findings').
            reply(403, {message: 'forbidden', status_code: 403});

        const result = await store.dispatch(Actions.getHealthFindings());

        expect(result.error).toBeDefined();
        expect(store.getState().entities.health.findings).toEqual({});
    });
});
