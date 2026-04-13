// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import Client4, {ClientError, HEADER_X_VERSION_ID} from './client4';
import {buildQueryString} from './helpers';

describe('Client4', () => {
    beforeAll(() => {
        if (!nock.isActive()) {
            nock.activate();
        }
    });

    afterAll(() => {
        nock.restore();
    });

    describe('property field routes', () => {
        let client: Client4;

        beforeEach(() => {
            client = new Client4();
            client.setUrl('http://mattermost.example.com');
        });

        test('getPropertyFieldsRoute should build correct URL', () => {
            expect(client.getPropertyFieldsRoute('my_group', 'user')).toBe(
                'http://mattermost.example.com/api/v4/properties/groups/my_group/user/fields',
            );
        });

        test('getPropertyFieldRoute should build correct URL', () => {
            expect(client.getPropertyFieldRoute('my_group', 'user', 'field123')).toBe(
                'http://mattermost.example.com/api/v4/properties/groups/my_group/user/fields/field123',
            );
        });

        test('getPropertyFields should send GET with correct query params', async () => {
            const fields = [{id: 'f1', name: 'test'}];
            nock(client.getBaseRoute()).
                get('/properties/groups/grp/user/fields').
                query({target_type: 'system', per_page: '10', cursor_id: 'abc', cursor_create_at: '999'}).
                reply(200, fields);

            const result = await client.getPropertyFields('grp', 'user', 'system', undefined, {
                perPage: 10,
                cursorId: 'abc',
                cursorCreateAt: 999,
            });

            expect(result).toEqual(fields);
        });

        test('getPropertyFields should include target_id when provided', async () => {
            nock(client.getBaseRoute()).
                get('/properties/groups/grp/user/fields').
                query({target_type: 'channel', target_id: 'ch1'}).
                reply(200, []);

            const result = await client.getPropertyFields('grp', 'user', 'channel', 'ch1');
            expect(result).toEqual([]);
        });

        test('getPropertyFields should send minimal params when no options', async () => {
            nock(client.getBaseRoute()).
                get('/properties/groups/grp/user/fields').
                query({target_type: 'system'}).
                reply(200, []);

            const result = await client.getPropertyFields('grp', 'user', 'system');
            expect(result).toEqual([]);
        });

        test('createPropertyField should send POST with field body', async () => {
            const field = {name: 'classification', type: 'select' as const, target_type: 'system'};
            const created = {id: 'new1', ...field};

            nock(client.getBaseRoute()).
                post('/properties/groups/grp/user/fields', (body) => {
                    return body.name === 'classification' && body.type === 'select';
                }).
                reply(201, created);

            const result = await client.createPropertyField('grp', 'user', field);
            expect(result).toEqual(created);
        });

        test('patchPropertyField should send PATCH to field URL', async () => {
            const patch = {attrs: {options: []}};
            const patched = {id: 'f1', name: 'classification', attrs: {options: []}};

            nock(client.getBaseRoute()).
                patch('/properties/groups/grp/user/fields/f1', (body) => {
                    return body.attrs !== undefined;
                }).
                reply(200, patched);

            const result = await client.patchPropertyField('grp', 'user', 'f1', patch);
            expect(result).toEqual(patched);
        });

        test('deletePropertyField should send DELETE to field URL', async () => {
            nock(client.getBaseRoute()).
                delete('/properties/groups/grp/user/fields/f1').
                reply(200, {status: 'OK'});

            const result = await client.deletePropertyField('grp', 'user', 'f1');
            expect(result).toEqual({status: 'OK'});
        });
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

