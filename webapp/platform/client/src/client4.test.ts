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

    describe('content flagging routes', () => {
        let client: Client4;

        beforeEach(() => {
            client = new Client4();
            client.setUrl('http://mattermost.example.com');
        });

        test('flagPost should send comment as a plain string', async () => {
            let receivedBody: any;
            nock(client.getBaseRoute()).
                post('/content_flagging/post/post123/flag', (body) => {
                    receivedBody = body;
                    return true;
                }).
                reply(200, {status: 'OK'});

            await client.flagPost('post123', 'Spam', 'looks suspicious');

            expect(receivedBody).toEqual({reason: 'Spam', comment: 'looks suspicious'});
        });

        test('flagPost should preserve an empty comment as an empty string', async () => {
            let receivedBody: any;
            nock(client.getBaseRoute()).
                post('/content_flagging/post/post123/flag', (body) => {
                    receivedBody = body;
                    return true;
                }).
                reply(200, {status: 'OK'});

            await client.flagPost('post123', 'Spam', '');

            expect(receivedBody).toEqual({reason: 'Spam', comment: ''});
        });

        test('removeFlaggedPost should send comment as a plain string', async () => {
            let receivedBody: any;
            nock(client.getBaseRoute()).
                put('/content_flagging/post/post123/remove', (body) => {
                    receivedBody = body;
                    return true;
                }).
                reply(200, {status: 'OK'});

            await client.removeFlaggedPost('post123', 'violates policy');

            expect(receivedBody).toEqual({comment: 'violates policy'});
        });

        test('removeFlaggedPost should preserve an empty comment as an empty string', async () => {
            let receivedBody: any;
            nock(client.getBaseRoute()).
                put('/content_flagging/post/post123/remove', (body) => {
                    receivedBody = body;
                    return true;
                }).
                reply(200, {status: 'OK'});

            await client.removeFlaggedPost('post123', '');

            expect(receivedBody).toEqual({comment: ''});
        });

        test('keepFlaggedPost should send comment as a plain string', async () => {
            let receivedBody: any;
            nock(client.getBaseRoute()).
                put('/content_flagging/post/post123/keep', (body) => {
                    receivedBody = body;
                    return true;
                }).
                reply(200, {status: 'OK'});

            await client.keepFlaggedPost('post123', 'looks fine');

            expect(receivedBody).toEqual({comment: 'looks fine'});
        });

        test('keepFlaggedPost should preserve an empty comment as an empty string', async () => {
            let receivedBody: any;
            nock(client.getBaseRoute()).
                put('/content_flagging/post/post123/keep', (body) => {
                    receivedBody = body;
                    return true;
                }).
                reply(200, {status: 'OK'});

            await client.keepFlaggedPost('post123', '');

            expect(receivedBody).toEqual({comment: ''});
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

        test('should parse ZIP responses as blobs', async () => {
            const client = new Client4();
            client.setUrl('http://mattermost.example.com');

            const postId = 'dummy-post-id';
            const zipData = Buffer.from('zip contents');

            nock(client.getBaseRoute()).
                post(`/content_flagging/post/${postId}/report`, {comment: 'investigation note'}).
                reply(200, zipData, {'Content-Type': 'application/zip'});

            const result = await client.generateFlaggedPostReport(postId, 'investigation note');

            expect(typeof result.text).toBe('function');
            expect(result.size).toEqual(zipData.length);
            expect(result.type).toEqual('application/zip');
            expect(await result.text()).toEqual('zip contents');
        });
    });

    describe('getSharedChannelInvitationsByRemote', () => {
        test('should request the shared_channel_invitations route with pagination query', async () => {
            const client = new Client4();
            client.setUrl('http://mattermost.example.com');

            const remoteId = 'abcdefghijklmnopqrstuvwxyz';
            const payload = [
                {
                    id: 'id000000000000000000000000',
                    channel_id: 'ch000000000000000000000000',
                    remote_id: remoteId,
                    direction: 'sent',
                    status: 'pending',
                    creator_id: 'cr000000000000000000000000',
                    create_at: 1,
                    update_at: 1,
                },
            ];

            nock(client.getBaseRoute()).
                get(`/remotecluster/${remoteId}/shared_channel_invitations${buildQueryString({page: 2, per_page: 25})}`).
                reply(200, payload);

            const result = await client.getSharedChannelInvitationsByRemote(remoteId, 2, 25);

            expect(result).toEqual(payload);
        });

        test('should default pagination to page 0 and per_page 60', async () => {
            const client = new Client4();
            client.setUrl('http://mattermost.example.com');

            const remoteId = 'abcdefghijklmnopqrstuvwxyz';
            const payload = [] as any;

            nock(client.getBaseRoute()).
                get(`/remotecluster/${remoteId}/shared_channel_invitations${buildQueryString({page: 0, per_page: 60})}`).
                reply(200, payload);

            const result = await client.getSharedChannelInvitationsByRemote(remoteId);

            expect(result).toEqual(payload);
        });
    });

    describe('getSharedChannelInvitationsByChannel', () => {
        test('should request the channel shared_channel_invitations route with pagination query', async () => {
            const client = new Client4();
            client.setUrl('http://mattermost.example.com');

            const channelId = 'ch000000000000000000000000';
            const payload: unknown[] = [];

            nock(client.getBaseRoute()).
                get(`/channels/${channelId}/shared_channel_invitations${buildQueryString({page: 0, per_page: 60})}`).
                reply(200, payload);

            const result = await client.getSharedChannelInvitationsByChannel(channelId);

            expect(result).toEqual(payload);
        });
    });

    describe('deleteSharedChannelInvitation', () => {
        test('should DELETE the invitation resource under the remote cluster route', async () => {
            const client = new Client4();
            client.setUrl('http://mattermost.example.com');

            const remoteId = 'abcdefghijklmnopqrstuvwxyz';
            const invitationId = 'inv000000000000000000000000';

            nock(client.getBaseRoute()).
                delete(`/remotecluster/${remoteId}/shared_channel_invitations/${invitationId}`).
                reply(200, {status: 'OK'});

            const result = await client.deleteSharedChannelInvitation(remoteId, invitationId);

            expect(result.status).toBe('OK');
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

