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

