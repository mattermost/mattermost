// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import Client4, {ClientError, HEADER_X_VERSION_ID} from './client4';
import {buildQueryString} from './helpers';
import type {TelemetryHandler} from './telemetry';

describe('Client4', () => {
    beforeAll(() => {
        if (!nock.isActive()) {
            nock.activate();
        }
    });

    afterAll(() => {
        nock.restore();
    });

    describe('doFetchWithResponse', () => {
        test('serverVersion should be set from response header', async () => {
            const client = new Client4();
            client.setUrl('http://mattermost.example.com');

            expect(client.serverVersion).toEqual('');

            nock(client.getBaseRoute()).
                get('/users/me').
                reply(200, '{}', {[HEADER_X_VERSION_ID]: '5.0.0.5.0.0.abc123'});

            await client.getMe();

            expect(client.serverVersion).toEqual('5.0.0.5.0.0.abc123');

            nock(client.getBaseRoute()).
                get('/users/me').
                reply(200, '{}', {[HEADER_X_VERSION_ID]: '5.3.0.5.3.0.abc123'});

            await client.getMe();

            expect(client.serverVersion).toEqual('5.3.0.5.3.0.abc123');
        });

        test('should parse NDJSON responses correctly', async () => {
            const client = new Client4();
            client.setUrl('http://mattermost.example.com');

            const userId = 'dummy-user-id';
            const page = -1; // Special value to trigger NDJSON response

            // Sample NDJSON data with multiple channel memberships on separate lines
            const ndjsonData = '{"user_id":"dummy-user-id","channel_id":"channel1","roles":"channel_user"}\n' +
                '{"user_id":"dummy-user-id","channel_id":"channel2","roles":"channel_user channel_admin"}\n' +
                '{"user_id":"dummy-user-id","channel_id":"channel3","roles":"channel_user"}';

            // Create a mock endpoint for getAllChannelsMembers that returns NDJSON data
            nock(client.getBaseRoute()).
                get(`/users/${userId}/channel_members${buildQueryString({page, per_page: 60})}`).
                reply(200, ndjsonData, {'Content-Type': 'application/x-ndjson'});

            // Call the getAllChannelsMembers method which will use our implementation for NDJSON
            const result = await client.getAllChannelsMembers(userId, page);

            // Verify the response was parsed as an array of objects
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(3);
            expect(result[0]).toEqual({user_id: 'dummy-user-id', channel_id: 'channel1', roles: 'channel_user'});
            expect(result[1]).toEqual({user_id: 'dummy-user-id', channel_id: 'channel2', roles: 'channel_user channel_admin'});
            expect(result[2]).toEqual({user_id: 'dummy-user-id', channel_id: 'channel3', roles: 'channel_user'});
        });
    });
});

describe('ClientError', () => {
    test('standard fields should be enumerable', () => {
        const error = new ClientError('https://example.com', {
            message: 'This is a message',
            server_error_id: 'test.app_error',
            status_code: 418,
            url: 'https://example.com/api/v4/error',
        });

        const copy = {...error};

        expect(copy.message).toEqual(error.message);
        expect(copy.server_error_id).toEqual(error.server_error_id);
        expect(copy.status_code).toEqual(error.status_code);
        expect(copy.url).toEqual(error.url);
    });

    test('cause should be preserved when provided', () => {
        const cause = new Error('the original error');
        const error = new ClientError('https://example.com', {
            message: 'This is a message',
            server_error_id: 'test.app_error',
            status_code: 418,
            url: 'https://example.com/api/v4/error',
        }, cause);

        const copy = {...error};

        expect(copy.message).toEqual(error.message);
        expect(copy.server_error_id).toEqual(error.server_error_id);
        expect(copy.status_code).toEqual(error.status_code);
        expect(copy.url).toEqual(error.url);
        expect(error.cause).toEqual(cause);
    });
});

describe('trackEvent', () => {
    class TestTelemetryHandler implements TelemetryHandler {
        trackEvent = jest.fn();
        trackFeatureEvent = jest.fn();
        pageVisited = jest.fn();
    }

    test('should call the attached RudderTelemetryHandler, if one is attached to Client4', () => {
        const client = new Client4();
        client.setUrl('http://mattermost.example.com');

        expect(() => client.trackEvent('test', 'onClick')).not.toThrowError();

        const handler = new TestTelemetryHandler();

        client.setTelemetryHandler(handler);
        client.trackEvent('test', 'onClick');

        expect(handler.trackEvent).toHaveBeenCalledTimes(1);
    });
});
