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

    describe('access control field autocomplete', () => {
        let client: Client4;

        beforeEach(() => {
            client = new Client4();
            client.setUrl('http://mattermost.example.com');
        });

        test('getAccessControlFields sends include_resource_fields when requested', async () => {
            const fields = [{id: 'f1', name: 'classification'}];
            nock(client.getBaseRoute()).
                get('/access_control_policies/cel/autocomplete/fields').
                query({after: '', limit: '100', include_resource_fields: 'true'}).
                reply(200, fields);

            const result = await client.getAccessControlFields('', 100, undefined, undefined, true);
            expect(result).toEqual(fields);
        });

        test('getAccessControlFields omits include_resource_fields by default', async () => {
            nock(client.getBaseRoute()).
                get('/access_control_policies/cel/autocomplete/fields').
                query((q) => q.include_resource_fields === undefined && q.after === '' && q.limit === '100').
                reply(200, []);

            const result = await client.getAccessControlFields('', 100);
            expect(result).toEqual([]);
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

    describe('team access control routes', () => {
        let client: Client4;

        beforeEach(() => {
            client = new Client4();
            client.setUrl('http://mattermost.example.com');
        });

        test('assignTeamsToAccessControlPolicy POSTs team_ids to the assign route', async () => {
            let receivedBody: any;
            nock(client.getBaseRoute()).
                post('/access_control_policies/pol1/assign', (body) => {
                    receivedBody = body;
                    return true;
                }).
                reply(200, {status: 'OK'});

            const result = await client.assignTeamsToAccessControlPolicy('pol1', ['team1', 'team2']);

            expect(receivedBody).toEqual({team_ids: ['team1', 'team2']});
            expect(result).toEqual({status: 'OK'});
        });

        test('unassignTeamsFromAccessControlPolicy DELETEs team_ids to the unassign route', async () => {
            let receivedBody: any;
            nock(client.getBaseRoute()).
                delete('/access_control_policies/pol1/unassign', (body) => {
                    receivedBody = body;
                    return true;
                }).
                reply(200, {status: 'OK'});

            const result = await client.unassignTeamsFromAccessControlPolicy('pol1', ['team1']);

            expect(receivedBody).toEqual({team_ids: ['team1']});
            expect(result).toEqual({status: 'OK'});
        });

        test('getTeamAccessControlPolicy GETs the per-team policy route', async () => {
            const response = {policy: null, enforced: false};
            nock(client.getBaseRoute()).
                get('/teams/team1/access_control/policy').
                reply(200, response);

            const result = await client.getTeamAccessControlPolicy('team1');
            expect(result).toEqual(response);
        });

        test('getProfilesMatchingTeamPolicy GETs users with not_in_team + abac_match_only', async () => {
            const profiles = [{id: 'u1'}];
            nock(client.getBaseRoute()).
                get('/users').
                query({not_in_team: 'team1', per_page: '60', abac_match_only: 'true'}).
                reply(200, profiles);

            const result = await client.getProfilesMatchingTeamPolicy('team1');
            expect(result).toEqual(profiles);
        });

        test('getProfilesMatchingTeamPolicy includes cursor_id when provided', async () => {
            const profiles: any[] = [];
            nock(client.getBaseRoute()).
                get('/users').
                query({not_in_team: 'team1', per_page: '60', abac_match_only: 'true', cursor_id: 'u9'}).
                reply(200, profiles);

            const result = await client.getProfilesMatchingTeamPolicy('team1', 60, 'u9');
            expect(result).toEqual(profiles);
        });

        test('getTeams sends for_directory=true so admins are filtered on the directory listing', async () => {
            const teams = [{id: 't1'}];
            nock(client.getBaseRoute()).
                get('/teams').
                query({page: '0', per_page: '60', include_total_count: 'true', exclude_policy_constrained: 'false', for_directory: 'true'}).
                reply(200, teams);

            const result = await client.getTeams(0, 60, true, false, true);
            expect(result).toEqual(teams);
        });

        test('getTeams defaults for_directory to false so the management listing stays complete', async () => {
            const teams = [{id: 't1'}];
            nock(client.getBaseRoute()).
                get('/teams').
                query({page: '0', per_page: '60', include_total_count: 'false', exclude_policy_constrained: 'false', for_directory: 'false'}).
                reply(200, teams);

            const result = await client.getTeams(0, 60);
            expect(result).toEqual(teams);
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

