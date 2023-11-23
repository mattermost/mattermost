// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import {getChannelByNameAndTeamName, getChannelMember, joinChannel} from 'mattermost-redux/actions/channels';
import {getUserByEmail} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';

import {emitChannelClickEvent} from 'actions/global_actions';

import {
    goToChannelByChannelName,
    goToDirectChannelByUserId,
    goToDirectChannelByUserIds,
    goToChannelByChannelId,
    goToDirectChannelByEmail,
    getPathFromIdentifier,
} from 'components/channel_layout/channel_identifier_router/actions';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import mockStore from 'tests/test_store';
import {joinPrivateChannelPrompt} from 'utils/channel_utils';

jest.mock('actions/global_actions', () => ({
    emitChannelClickEvent: jest.fn(),
}));

jest.mock('mattermost-redux/actions/channels', () => ({
    joinChannel: jest.fn(() => ({type: '', data: {channel: {id: 'channel_id3', name: 'achannel3', team_id: 'team_id1', type: 'O'}}})),
    getChannelByNameAndTeamName: jest.fn(() => ({type: '', data: {id: 'channel_id3', name: 'achannel3', team_id: 'team_id1', type: 'O'}})),
    getChannelMember: jest.fn(() => ({type: '', error: {}})),
}));

jest.mock('mattermost-redux/actions/users', () => ({
    getUserByEmail: jest.fn(() => ({type: '', data: {id: 'user_id3', email: 'user3@bladekick.com', username: 'user3'}})),
    getUser: jest.fn(() => ({type: '', data: {id: 'user_id3', email: 'user3@bladekick.com', username: 'user3'}})),
}));

jest.mock('utils/channel_utils', () => ({
    joinPrivateChannelPrompt: jest.fn(() => {
        return async () => {
            return {data: {join: true}};
        };
    }),
}));

describe('Actions', () => {
    const channel1 = {id: 'channel_id1', name: 'achannel', team_id: 'team_id1'};
    const channel2 = {id: 'channel_id2', name: 'achannel', team_id: 'team_id2'};
    const channel3 = {id: 'channel_id3', name: 'achannel3', team_id: 'team_id1', type: 'O'};
    const channel4 = {id: 'channel_id4', name: 'additional-abilities---community-systems', team_id: 'team_id1', type: 'O'};
    const channel5 = {id: 'channel_id5', name: 'some-group-channel', team_id: 'team_id1', type: 'G'};
    const channel6 = {id: 'channel_id6', name: '12345678901234567890123456', team_id: 'team_id1', type: 'O'};

    const initialState = {
        entities: {
            channels: {
                currentChannelId: 'channel_id1',
                channels: {channel_id1: channel1, channel_id2: channel2, channel_id3: channel3, channel_id4: channel4, channel_id5: channel5, channel_id6: channel6},
                myMembers: {channel_id1: {channel_id: 'channel_id1', user_id: 'current_user_id'}, channel_id2: {channel_id: 'channel_id2', user_id: 'current_user_id'}},
                channelsInTeam: {team_id1: ['channel_id1'], team_id2: ['channel_id2']},
            },
            teams: {
                currentTeamId: 'team_id1',
                teams: {
                    team_id1: {
                        id: 'team_id1',
                        name: 'team1',
                    },
                    team_id2: {
                        id: 'team_id2',
                        name: 'team2',
                    },
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {user_id2: {id: 'user_id2', username: 'user2', email: 'user2@bladekick.com'}},
            },
            general: {license: {IsLicensed: 'false'}, config: {}},
            preferences: {myPreferences: {}},
        },
    };

    describe('getPathFromIdentifier', () => {
        test.each([
            {desc: 'identifier is a channel name', expected: 'channel_name', path: 'channels', identifier: 'channelName'},
            {desc: 'identifier is a group id', expected: 'group_channel_group_id', path: 'channels', identifier: '9c992e32cc7b3e5651f68b0ead4935fdf40d67ff'},
            {desc: 'channel exists and is type G', expected: 'group_channel_group_id', path: 'channels', identifier: 'some-group-channel'},
            {desc: 'identifier is a group id', expected: 'group_channel_group_id', path: 'messages', identifier: '9c992e32cc7b3e5651f68b0ead4935fdf40d67ff'},
            {desc: 'identifier looks like a group id but matching channel is an open channel', expected: 'channel_name', path: 'channels', identifier: 'additional-abilities--community-systems'},
            {desc: 'identifier is in the format userid--userid2', expected: 'channel_name', path: 'channels', identifier: '3y8ujrgtbfn78ja5nfms3qm5jw--3y8ujrgtbfn78ja5nfms3qm5jw'},
            {desc: 'identifier is the username', expected: 'direct_channel_username', path: 'messages', identifier: '@user1'},
            {desc: 'identifier is the user email', expected: 'direct_channel_email', path: 'messages', identifier: 'user1@bladekick.com'},
            {desc: 'identifier is the user id', expected: 'direct_channel_user_id', path: 'messages', identifier: '3y8ujrgtbfn78ja5nfms3qm5jw'},
            {desc: 'the path is not right', expected: 'error', path: 'messages', identifier: 'test'},
        ])('Should return $expected if $desc', async ({expected, path, identifier}) => {
            const res = await getPathFromIdentifier((initialState as any), path, identifier);
            expect(res).toEqual(expected);
        });

        describe('identifier is 26 char long', () => {
            beforeAll(() => {
                TestHelper.initBasic(Client4);
            });

            afterAll(() => {
                TestHelper.tearDown();
            });

            test.each([
                {desc: 'fetching a channel by id succeeds', expected: 'channel_id', statusCode: 200, identifier: 'pjz4yj7jw7nzmmo3upi4htmt1y'},
                {desc: 'fetching a channel by id fails status 404', expected: 'channel_name', statusCode: 404, identifier: 'channelnamethatis26charlon'},
                {desc: 'fetching a channel by id fails status not 404', expected: 'error', statusCode: 403, identifier: 'channelnamethatis26charlon'},
                {desc: 'identifier is a channel name stored in redux (no fetching happens)', expected: 'channel_name', identifier: '12345678901234567890123456'},
            ])('Should return $expected if $desc', async ({expected, statusCode, identifier}) => {
                const scope = nock(Client4.getBaseRoute()).
                    get(`/channels/${identifier}`).
                    reply(statusCode, {status_code: statusCode});

                const res = await getPathFromIdentifier((initialState as any), 'channels', identifier);
                expect(res).toEqual(expected);

                expect(scope.isDone()).toBe(Boolean(statusCode));
            });
        });
    });

    describe('goToChannelByChannelId', () => {
        test('switch to public channel we have locally but need to join', async () => {
            const testStore = await mockStore(initialState);
            const history = {replace: jest.fn()};

            await testStore.dispatch((goToChannelByChannelId({params: {team: 'team1', identifier: 'channel_id3', path: '/'}, url: ''}, history as any) as any));
            expect(joinChannel).toHaveBeenCalledWith('current_user_id', 'team_id1', 'channel_id3', '');
            expect(history.replace).toHaveBeenCalledWith('/team1/channels/achannel3');
        });
    });

    describe('goToChannelByChannelName', () => {
        test('switch to channel on different team with same name', async () => {
            const testStore = await mockStore(initialState);

            await testStore.dispatch((goToChannelByChannelName({params: {team: 'team2', identifier: 'achannel', path: '/'}, url: ''}, {} as any) as any));
            expect(emitChannelClickEvent).toHaveBeenCalledWith(channel2);
        });

        test('switch to public channel we have locally but need to join', async () => {
            const testStore = await mockStore(initialState);

            await testStore.dispatch((goToChannelByChannelName({params: {team: 'team1', identifier: 'achannel3', path: '/'}, url: ''}, {} as any) as any));
            expect(joinChannel).toHaveBeenCalledWith('current_user_id', 'team_id1', '', 'achannel3');
            expect(emitChannelClickEvent).toHaveBeenCalledWith(channel3);
        });

        test('switch to private channel we don\'t have locally and get prompted if super user and then join', async () => {
            const testStore = await mockStore({
                ...initialState,
                entities: {
                    ...initialState.entities,
                    users: {
                        ...initialState.entities.users,
                        profiles: {
                            ...initialState.entities.users.profiles,
                            current_user_id: {
                                roles: 'system_admin',
                            },
                        },
                    },
                },
            });
            const channel = {id: 'channel_id6', name: 'achannel6', team_id: 'team_id1', type: 'P'};
            (joinChannel as jest.Mock).mockReturnValueOnce({type: '', data: {channel}});
            (getChannelByNameAndTeamName as jest.Mock).mockReturnValueOnce({type: '', data: channel});
            await testStore.dispatch((goToChannelByChannelName({params: {team: 'team1', identifier: channel.name, path: '/'}, url: ''}, {} as any) as any));
            expect(getChannelByNameAndTeamName).toHaveBeenCalledWith('team1', channel.name, true);
            expect(getChannelMember).toHaveBeenCalledWith(channel.id, 'current_user_id');
            expect(joinPrivateChannelPrompt).toHaveBeenCalled();
            expect(joinChannel).toHaveBeenCalledWith('current_user_id', 'team_id1', '', channel.name);
        });
    });

    describe('goToDirectChannelByUserId', () => {
        test('switch to a direct channel by user id on the same team', async () => {
            const testStore = await mockStore(initialState);
            const history = {replace: jest.fn()};

            await testStore.dispatch((goToDirectChannelByUserId({params: {team: 'team1', identifier: 'channel', path: '/'}, url: ''}, history as any, 'user_id2') as any));
            expect(history.replace).toHaveBeenCalledWith('/team1/messages/@user2');
        });

        test('switch to a direct channel by user id on different team', async () => {
            const testStore = await mockStore(initialState);
            const history = {replace: jest.fn()};

            await testStore.dispatch((goToDirectChannelByUserId({params: {team: 'team2', identifier: 'channel', path: '/'}, url: ''}, history as any, 'user_id2') as any));
            expect(history.replace).toHaveBeenCalledWith('/team2/messages/@user2');
        });
    });

    describe('goToDirectChannelByUserIds', () => {
        test('switch to a direct channel by name on the same team', async () => {
            const testStore = await mockStore(initialState);
            const history = {replace: jest.fn()};

            await testStore.dispatch((goToDirectChannelByUserIds({params: {team: 'team1', identifier: 'current_user_id__user_id2', path: '/'}, url: ''}, history as any) as any));
            expect(history.replace).toHaveBeenCalledWith('/team1/messages/@user2');
        });

        test('switch to a direct channel by name on different team', async () => {
            const testStore = await mockStore(initialState);
            const history = {replace: jest.fn()};

            await testStore.dispatch((goToDirectChannelByUserIds({params: {team: 'team2', identifier: 'current_user_id__user_id2', path: '/'}, url: ''}, history as any) as any));
            expect(history.replace).toHaveBeenCalledWith('/team2/messages/@user2');
        });
    });

    describe('goToDirectChannelByEmail', () => {
        test('switch to a direct channel by email with user already existing locally', async () => {
            const testStore = await mockStore(initialState);
            const history = {replace: jest.fn()};

            await testStore.dispatch((goToDirectChannelByEmail({params: {team: 'team1', identifier: 'user2@bladekick.com', path: '/'}, url: ''}, history as any) as any));
            expect(getUserByEmail).not.toHaveBeenCalled();
            expect(history.replace).toHaveBeenCalledWith('/team1/messages/@user2');
        });

        test('switch to a direct channel by email with user not existing locally', async () => {
            const testStore = await mockStore(initialState);
            const history = {replace: jest.fn()};

            await testStore.dispatch((goToDirectChannelByEmail({params: {team: 'team1', identifier: 'user3@bladekick.com', path: '/'}, url: ''}, history as any) as any));
            expect(getUserByEmail).toHaveBeenCalledWith('user3@bladekick.com');
            expect(history.replace).toHaveBeenCalledWith('/team1/messages/@user3');
        });
    });
});
