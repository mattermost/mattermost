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

    test('getHealthFindings stores the findings by fingerprint and the evaluation time', async () => {
        const list = {evaluated_at: 5000, findings: [finding]};
        nock(Client4.getBaseRoute()).
            get('/health/findings').
            query({muted: 'included'}).
            reply(200, list);

        const result = await store.dispatch(Actions.getHealthFindings());

        expect(result).toEqual({data: list});
        expect(store.getState().entities.health.findings).toEqual({[finding.fingerprint]: finding});
        expect(store.getState().entities.health.evaluatedAt).toBe(5000);
    });

    test('getHealthFindings sends the muted filter as a query parameter', async () => {
        nock(Client4.getBaseRoute()).
            get('/health/findings').
            query({muted: 'only'}).
            reply(200, {evaluated_at: 5000, findings: []});

        const result = await store.dispatch(Actions.getHealthFindings({muted: 'only'}));

        expect(result).toEqual({data: {evaluated_at: 5000, findings: []}});
    });

    test('getHealthFindings returns the error and keeps the store unchanged on failure', async () => {
        nock(Client4.getBaseRoute()).
            get('/health/findings').
            query({muted: 'included'}).
            reply(403, {message: 'forbidden', status_code: 403});

        const result = await store.dispatch(Actions.getHealthFindings());

        expect(result.error).toBeDefined();
        expect(store.getState().entities.health).toEqual({findings: {}, evaluatedAt: 0});
    });

    describe('mute and unmute', () => {
        const muted: HealthFinding = {...finding, muted_at: 4000, muted_by: 'admin2'};

        afterEach(() => {
            jest.restoreAllMocks();
        });

        function storeWith(stored: HealthFinding) {
            return configureStore({
                entities: {
                    users: {currentUserId: 'admin1'},
                    health: {findings: {[stored.fingerprint]: stored}, evaluatedAt: 5000},
                },
            });
        }

        function stored(s: ReturnType<typeof configureStore>) {
            return s.getState().entities.health.findings[finding.fingerprint];
        }

        test('muteHealthFinding marks the finding muted by the current user before the server answers', async () => {
            jest.spyOn(Date, 'now').mockReturnValue(6000);
            store = storeWith(finding);
            nock(Client4.getBaseRoute()).
                post(`/health/findings/${finding.fingerprint}/mute`).
                reply(200, {status: 'OK'});

            const pending = store.dispatch(Actions.muteHealthFinding(finding.fingerprint));
            expect(stored(store)).toEqual({...finding, muted_at: 6000, muted_by: 'admin1'});

            expect(await pending).toEqual({data: true});
            expect(stored(store)).toEqual({...finding, muted_at: 6000, muted_by: 'admin1'});
        });

        test('muteHealthFinding restores the unmuted finding and returns the error when the request fails', async () => {
            store = storeWith(finding);
            nock(Client4.getBaseRoute()).
                post(`/health/findings/${finding.fingerprint}/mute`).
                reply(500, {message: 'failed', status_code: 500});

            const pending = store.dispatch(Actions.muteHealthFinding(finding.fingerprint));
            expect(stored(store).muted_at).toBeDefined();

            const result = await pending;
            expect(result.error).toBeDefined();
            expect(stored(store)).toEqual(finding);
        });

        test('unmuteHealthFinding clears the mute before the server answers', async () => {
            store = storeWith(muted);
            nock(Client4.getBaseRoute()).
                delete(`/health/findings/${finding.fingerprint}/mute`).
                reply(200, {status: 'OK'});

            const pending = store.dispatch(Actions.unmuteHealthFinding(finding.fingerprint));
            expect(stored(store).muted_at).toBeUndefined();
            expect(stored(store).muted_by).toBeUndefined();

            expect(await pending).toEqual({data: true});
            expect(stored(store).muted_at).toBeUndefined();
        });

        test('unmuteHealthFinding restores the mute and returns the error when the request fails', async () => {
            store = storeWith(muted);
            nock(Client4.getBaseRoute()).
                delete(`/health/findings/${finding.fingerprint}/mute`).
                reply(403, {message: 'forbidden', status_code: 403});

            const result = await store.dispatch(Actions.unmuteHealthFinding(finding.fingerprint));

            expect(result.error).toBeDefined();
            expect(stored(store)).toEqual(muted);
        });
    });
});
