// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {Group} from '@mattermost/types/groups';
import type {PreferencesType} from '@mattermost/types/preferences';
import type {GlobalState} from '@mattermost/types/store';
import type {Team, TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {General, Preferences} from 'mattermost-redux/constants';
import * as Selectors from 'mattermost-redux/selectors/entities/users';
import deepFreezeAndThrowOnMutation from 'mattermost-redux/utils/deep_freeze';
import {sortByUsername} from 'mattermost-redux/utils/user_utils';

import TestHelper from '../../../test/test_helper';

const searchProfilesMatchingWithTerm = Selectors.makeSearchProfilesMatchingWithTerm();
const searchProfilesStartingWithTerm = Selectors.makeSearchProfilesStartingWithTerm();

describe('Selectors.Users', () => {
    const team1 = TestHelper.fakeTeamWithId();

    const channel1 = TestHelper.fakeChannelWithId(team1.id);
    const channel2 = TestHelper.fakeChannelWithId(team1.id);

    const group1 = TestHelper.fakeGroupWithId('');
    const group2 = TestHelper.fakeGroupWithId('');

    const user1 = TestHelper.fakeUserWithId('');
    user1.position = 'Software Engineer at Mattermost';
    user1.notify_props = {mention_keys: 'testkey1,testkey2'} as UserProfile['notify_props'];
    user1.roles = 'system_admin system_user';
    const user2 = TestHelper.fakeUserWithId();
    user2.delete_at = 1;
    const user3 = TestHelper.fakeUserWithId();
    const user4 = TestHelper.fakeUserWithId();
    const user5 = TestHelper.fakeUserWithId();
    const user6 = TestHelper.fakeUserWithId();
    user6.roles = 'system_admin system_user';
    const user7 = TestHelper.fakeUserWithId();
    user7.delete_at = 1;
    user7.roles = 'system_admin system_user';
    const profiles: Record<string, UserProfile> = {};
    profiles[user1.id] = user1;
    profiles[user2.id] = user2;
    profiles[user3.id] = user3;
    profiles[user4.id] = user4;
    profiles[user5.id] = user5;
    profiles[user6.id] = user6;
    profiles[user7.id] = user7;

    const profilesInTeam: Record<Team['id'], Set<UserProfile['id']>> = {};
    profilesInTeam[team1.id] = new Set([user1.id, user2.id, user7.id]);

    const membersInTeam: Record<Team['id'], Record<UserProfile['id'], TeamMembership>> = {};
    membersInTeam[team1.id] = {};
    membersInTeam[team1.id][user1.id] = {
        ...TestHelper.fakeTeamMember(user1.id, team1.id),
        scheme_user: true,
        scheme_admin: true,
    };
    membersInTeam[team1.id][user2.id] = {
        ...TestHelper.fakeTeamMember(user2.id, team1.id),
        scheme_user: true,
        scheme_admin: false,
    };
    membersInTeam[team1.id][user7.id] = {
        ...TestHelper.fakeTeamMember(user7.id, team1.id),
        scheme_user: true,
        scheme_admin: false,
    };

    const profilesNotInTeam: Record<Team['id'], Set<UserProfile['id']>> = {};
    profilesNotInTeam[team1.id] = new Set([user3.id, user4.id]);

    const profilesWithoutTeam = new Set([user5.id, user6.id]);

    const profilesInChannel: Record<Channel['id'], Set<UserProfile['id']>> = {};
    profilesInChannel[channel1.id] = new Set([user1.id]);
    profilesInChannel[channel2.id] = new Set([user1.id, user2.id]);

    const membersInChannel: Record<Channel['id'], Record<UserProfile['id'], ChannelMembership>> = {};
    membersInChannel[channel1.id] = {};
    membersInChannel[channel1.id][user1.id] = {
        ...TestHelper.fakeChannelMember(user1.id, channel1.id),
        scheme_user: true,
        scheme_admin: true,
    };
    membersInChannel[channel2.id] = {};
    membersInChannel[channel2.id][user1.id] = {
        ...TestHelper.fakeChannelMember(user1.id, channel2.id),
        scheme_user: true,
        scheme_admin: true,
    };
    membersInChannel[channel2.id][user2.id] = {
        ...TestHelper.fakeChannelMember(user2.id, channel2.id),
        scheme_user: true,
        scheme_admin: false,
    };

    const profilesNotInChannel: Record<Channel['id'], Set<UserProfile['id']>> = {};
    profilesNotInChannel[channel1.id] = new Set([user2.id, user3.id]);
    profilesNotInChannel[channel2.id] = new Set([user4.id, user5.id]);

    const profilesInGroup: Record<Group['id'], Set<UserProfile['id']>> = {};
    profilesInGroup[group1.id] = new Set([user1.id]);
    profilesInGroup[group2.id] = new Set([user2.id, user3.id]);

    const userSessions = [{
        create_at: 1,
        expires_at: 2,
        props: {},
        user_id: user1.id,
        roles: '',
    }];

    const userAudits = [{
        action: 'test_user_action',
        create_at: 1535007018934,
        extra_info: 'success',
        id: 'test_id',
        ip_address: '::1',
        session_id: '',
        user_id: 'test_user_id',
    }];

    const myPreferences: PreferencesType = {};
    myPreferences[`${Preferences.CATEGORY_DIRECT_CHANNEL_SHOW}--${user2.id}`] = {category: Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, name: user2.id, value: 'true', user_id: ''};
    myPreferences[`${Preferences.CATEGORY_DIRECT_CHANNEL_SHOW}--${user3.id}`] = {category: Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, name: user3.id, value: 'false', user_id: ''};

    const testState = deepFreezeAndThrowOnMutation({
        entities: {
            users: {
                currentUserId: user1.id,
                profiles,
                profilesInTeam,
                profilesNotInTeam,
                profilesWithoutTeam,
                profilesInChannel,
                profilesNotInChannel,
                profilesInGroup,
                mySessions: userSessions,
                myAudits: userAudits,
            },
            teams: {
                currentTeamId: team1.id,
                membersInTeam,
            },
            channels: {
                currentChannelId: channel1.id,
                membersInChannel,
            },
            preferences: {
                myPreferences,
            },
        },
    });

    it('getUserIdsInChannels', () => {
        expect(Selectors.getUserIdsInChannels(testState)).toEqual(profilesInChannel);
    });

    it('getUserIdsNotInChannels', () => {
        expect(Selectors.getUserIdsNotInChannels(testState)).toEqual(profilesNotInChannel);
    });

    it('getUserIdsInTeams', () => {
        expect(Selectors.getUserIdsInTeams(testState)).toEqual(profilesInTeam);
    });

    it('getUserIdsNotInTeams', () => {
        expect(Selectors.getUserIdsNotInTeams(testState)).toEqual(profilesNotInTeam);
    });

    it('getUserIdsWithoutTeam', () => {
        expect(Selectors.getUserIdsWithoutTeam(testState)).toEqual(profilesWithoutTeam);
    });

    it('getUserSessions', () => {
        expect(Selectors.getUserSessions(testState)).toEqual(userSessions);
    });

    it('getUserAudits', () => {
        expect(Selectors.getUserAudits(testState)).toEqual(userAudits);
    });

    it('getUser', () => {
        expect(Selectors.getUser(testState, user1.id)).toEqual(user1);
    });

    it('getUsers', () => {
        expect(Selectors.getUsers(testState)).toEqual(profiles);
    });

    describe('getCurrentUserMentionKeys', () => {
        it('at mention', () => {
            const userId = '1234';
            const notifyProps = {};
            const state = {
                entities: {
                    users: {
                        currentUserId: userId,
                        profiles: {
                            [userId]: {id: userId, username: 'user', first_name: 'First', last_name: 'Last', notify_props: notifyProps},
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getCurrentUserMentionKeys(state)).toEqual([{key: '@user'}]);
        });

        it('channel', () => {
            const userId = '1234';
            const notifyProps = {
                channel: 'true',
            };
            const state = {
                entities: {
                    users: {
                        currentUserId: userId,
                        profiles: {
                            [userId]: {id: userId, username: 'user', first_name: 'First', last_name: 'Last', notify_props: notifyProps},
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getCurrentUserMentionKeys(state)).toEqual([{key: '@channel'}, {key: '@all'}, {key: '@here'}, {key: '@user'}]);
        });

        it('first name', () => {
            const userId = '1234';
            const notifyProps = {
                first_name: 'true',
            };
            const state = {
                entities: {
                    users: {
                        currentUserId: userId,
                        profiles: {
                            [userId]: {id: userId, username: 'user', first_name: 'First', last_name: 'Last', notify_props: notifyProps},
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getCurrentUserMentionKeys(state)).toEqual([{key: 'First', caseSensitive: true}, {key: '@user'}]);
        });

        it('custom keys', () => {
            const userId = '1234';
            const notifyProps = {
                mention_keys: 'test,foo,@user,user',
            };
            const state = {
                entities: {
                    users: {
                        currentUserId: userId,
                        profiles: {
                            [userId]: {id: userId, username: 'user', first_name: 'First', last_name: 'Last', notify_props: notifyProps},
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getCurrentUserMentionKeys(state)).toEqual([{key: 'test'}, {key: 'foo'}, {key: '@user'}, {key: 'user'}]);
        });
    });

    describe('getProfiles', () => {
        it('getProfiles without filter', () => {
            const users = [user1, user2, user3, user4, user5, user6, user7].sort(sortByUsername);
            expect(Selectors.getProfiles(testState)).toEqual(users);
        });

        it('getProfiles with role filter', () => {
            const users = [user1, user6, user7].sort(sortByUsername);
            expect(Selectors.getProfiles(testState, {role: 'system_admin'})).toEqual(users);
        });
        it('getProfiles with inactive', () => {
            const users = [user2, user7].sort(sortByUsername);
            expect(Selectors.getProfiles(testState, {inactive: true})).toEqual(users);
        });
        it('getProfiles with active', () => {
            const users = [user1, user3, user4, user5, user6].sort(sortByUsername);
            expect(Selectors.getProfiles(testState, {active: true})).toEqual(users);
        });
        it('getProfiles with multiple filters', () => {
            const users = [user7];
            expect(Selectors.getProfiles(testState, {role: 'system_admin', inactive: true})).toEqual(users);
        });
    });

    describe('getProfilesInCurrentTeam', () => {
        it('getProfilesInCurrentTeam', () => {
            const users = [user1, user2, user7].sort(sortByUsername);
            expect(Selectors.getProfilesInCurrentTeam(testState)).toEqual(users);
        });

        const remoteUser = TestHelper.fakeUserWithId();
        remoteUser.remote_id = 'remoteID';
        const state = {
            ...testState,
            entities: {
                ...testState.entities,
                users: {
                    ...testState.entities.users,
                    profiles: {
                        ...testState.entities.users.profiles,
                        [remoteUser.id]: remoteUser,
                    },
                    profilesInTeam: {
                        ...testState.entities.users.profilesInTeam,
                        [team1.id]: new Set([...testState.entities.users.profilesInTeam[team1.id], remoteUser.id]),
                    },
                },
                teams: {
                    ...testState.teams,
                    currentTeamId: team1.id,
                    membersInTeam,
                },
            },
        };

        it('getProfilesInCurrentTeam include remote', () => {
            const users = [user1, user2, user7, remoteUser].sort(sortByUsername);
            expect(Selectors.getProfilesInCurrentTeam(state)).toEqual(users);
        });

        it('getProfilesInCurrentTeam with remote filter', () => {
            const users = [user1, user2, user7].sort(sortByUsername);
            const filters = {exclude_remote: true};
            expect(Selectors.getProfilesInCurrentTeam(state, filters)).toEqual(users);
        });
    });

    describe('getProfilesNotInCurrentChannel', () => {
        it('getProfilesNotInCurrentChannel', () => {
            const users = [user2, user3].sort(sortByUsername);
            expect(Selectors.getProfilesNotInCurrentChannel(testState)).toEqual(users);
        });

        const remoteUser = TestHelper.fakeUserWithId();
        remoteUser.remote_id = 'remoteID';
        const state = {
            ...testState,
            entities: {
                ...testState.entities,
                users: {
                    ...testState.entities.users,
                    profiles: {
                        ...testState.entities.users.profiles,
                        [remoteUser.id]: remoteUser,
                    },
                    profilesNotInChannel: {
                        ...testState.entities.users.profilesNotInChannel,
                        [channel1.id]: new Set([...testState.entities.users.profilesNotInChannel[channel1.id], remoteUser.id]),
                    },
                },
            },
        };

        it('getProfilesNotInCurrentChannel include remote', () => {
            const users = [user2, user3, remoteUser].sort(sortByUsername);
            expect(Selectors.getProfilesNotInCurrentChannel(state)).toEqual(users);
        });

        it('getProfilesNotInCurrentChannel with remote filter', () => {
            const users = [user2, user3].sort(sortByUsername);
            const filters = {exclude_remote: true};
            expect(Selectors.getProfilesNotInCurrentChannel(state, filters)).toEqual(users);
        });
    });

    describe('getProfilesInTeam', () => {
        it('getProfilesInTeam without filter', () => {
            const users = [user1, user2, user7].sort(sortByUsername);
            expect(Selectors.getProfilesInTeam(testState, team1.id)).toEqual(users);
            expect(Selectors.getProfilesInTeam(testState, 'junk')).toEqual([]);
        });
        it('getProfilesInTeam with role filter', () => {
            const users = [user1, user7].sort(sortByUsername);
            expect(Selectors.getProfilesInTeam(testState, team1.id, {role: 'system_admin'})).toEqual(users);
            expect(Selectors.getProfilesInTeam(testState, 'junk', {role: 'system_admin'})).toEqual([]);
        });
        it('getProfilesInTeam with inactive filter', () => {
            const users = [user2, user7].sort(sortByUsername);
            expect(Selectors.getProfilesInTeam(testState, team1.id, {inactive: true})).toEqual(users);
            expect(Selectors.getProfilesInTeam(testState, 'junk', {inactive: true})).toEqual([]);
        });
        it('getProfilesInTeam with active', () => {
            const users = [user1];
            expect(Selectors.getProfilesInTeam(testState, team1.id, {active: true})).toEqual(users);
            expect(Selectors.getProfilesInTeam(testState, 'junk', {active: true})).toEqual([]);
        });
        it('getProfilesInTeam with role filters', () => {
            expect(Selectors.getProfilesInTeam(testState, team1.id, {roles: ['system_admin']})).toEqual([user1, user7].sort(sortByUsername));
            expect(Selectors.getProfilesInTeam(testState, team1.id, {team_roles: ['team_user']})).toEqual([user2]);
        });
        it('getProfilesInTeam with multiple filters', () => {
            const users = [user7];
            expect(Selectors.getProfilesInTeam(testState, team1.id, {role: 'system_admin', inactive: true})).toEqual(users);
        });
    });

    describe('getProfilesNotInTeam', () => {
        const users = [user3, user4].sort(sortByUsername);
        expect(Selectors.getProfilesNotInTeam(testState, team1.id)).toEqual(users);
        expect(Selectors.getProfilesNotInTeam(testState, team1.id, {role: 'system_user'})).toEqual(users);
        expect(Selectors.getProfilesNotInTeam(testState, team1.id, {role: 'system_guest'})).toEqual([]);
    });

    it('getProfilesNotInCurrentTeam', () => {
        const users = [user3, user4].sort(sortByUsername);
        expect(Selectors.getProfilesNotInCurrentTeam(testState)).toEqual(users);
    });

    describe('getProfilesWithoutTeam', () => {
        it('getProfilesWithoutTeam', () => {
            const users = [user5, user6].sort(sortByUsername);
            expect(Selectors.getProfilesWithoutTeam(testState, {} as any)).toEqual(users);
        });
        it('getProfilesWithoutTeam with filter', () => {
            expect(Selectors.getProfilesWithoutTeam(testState, {role: 'system_admin'})).toEqual([user6]);
        });
    });

    it('getProfilesInGroup', () => {
        expect(Selectors.getProfilesInGroup(testState, group1.id)).toEqual([user1]);
        const users = [user2, user3].sort(sortByUsername);
        expect(Selectors.getProfilesInGroup(testState, group2.id)).toEqual(users);
    });

    describe('searchProfilesStartingWithTerm', () => {
        it('searchProfiles without filter', () => {
            expect(searchProfilesStartingWithTerm(testState, user1.username)).toEqual([user1]);
            expect(searchProfilesStartingWithTerm(testState, user2.first_name + ' ' + user2.last_name)).toEqual([user2]);
            expect(searchProfilesStartingWithTerm(testState, user1.username, true)).toEqual([]);
        });

        it('searchProfiles with filters', () => {
            expect(searchProfilesStartingWithTerm(testState, user1.username, false, {role: 'system_admin'})).toEqual([user1]);
            expect(searchProfilesStartingWithTerm(testState, user3.username, false, {role: 'system_admin'})).toEqual([]);
            expect(searchProfilesStartingWithTerm(testState, user1.username, false, {roles: ['system_user']})).toEqual([]);
            expect(searchProfilesStartingWithTerm(testState, user3.username, false, {roles: ['system_user']})).toEqual([user3]);
            expect(searchProfilesStartingWithTerm(testState, user3.username, false, {inactive: true})).toEqual([]);
            expect(searchProfilesStartingWithTerm(testState, user2.username, false, {inactive: true})).toEqual([user2]);
            expect(searchProfilesStartingWithTerm(testState, user2.username, false, {active: true})).toEqual([]);
            expect(searchProfilesStartingWithTerm(testState, user3.username, false, {active: true})).toEqual([user3]);
        });
    });

    describe('searchProfilesMatchingWithTerm', () => {
        it('searchProfiles without filter', () => {
            expect(searchProfilesMatchingWithTerm(testState, user1.username.slice(1, user1.username.length))).toEqual([user1]);
            expect(searchProfilesMatchingWithTerm(testState, ' ' + user2.last_name)).toEqual([user2]);
        });

        it('searchProfiles with filters', () => {
            expect(searchProfilesMatchingWithTerm(testState, user1.username.slice(2, user1.username.length), false, {role: 'system_admin'})).toEqual([user1]);
            expect(searchProfilesMatchingWithTerm(testState, user3.username.slice(3, user3.username.length), false, {role: 'system_admin'})).toEqual([]);
            expect(searchProfilesMatchingWithTerm(testState, user1.username.slice(0, user1.username.length), false, {roles: ['system_user']})).toEqual([]);
            expect(searchProfilesMatchingWithTerm(testState, user3.username, false, {roles: ['system_user']})).toEqual([user3]);
            expect(searchProfilesMatchingWithTerm(testState, user3.username, false, {inactive: true})).toEqual([]);
            expect(searchProfilesMatchingWithTerm(testState, user2.username, false, {inactive: true})).toEqual([user2]);
            expect(searchProfilesMatchingWithTerm(testState, user2.username, false, {active: true})).toEqual([]);
            expect(searchProfilesMatchingWithTerm(testState, user3.username, false, {active: true})).toEqual([user3]);
        });
    });

    it('searchProfilesInChannel', () => {
        const doSearchProfilesInChannel = Selectors.makeSearchProfilesInChannel();
        expect(doSearchProfilesInChannel(testState, channel1.id, user1.username)).toEqual([user1]);
        expect(doSearchProfilesInChannel(testState, channel1.id, user1.username, true)).toEqual([]);
        expect(doSearchProfilesInChannel(testState, channel2.id, user2.username)).toEqual([user2]);
        expect(doSearchProfilesInChannel(testState, channel2.id, user2.username, false, {active: true})).toEqual([]);
    });

    it('searchProfilesInCurrentChannel', () => {
        expect(Selectors.searchProfilesInCurrentChannel(testState, user1.username)).toEqual([user1]);
        expect(Selectors.searchProfilesInCurrentChannel(testState, 'engineer at mattermost')).toEqual([user1]);
        expect(Selectors.searchProfilesInCurrentChannel(testState, user1.username, true)).toEqual([]);
    });

    it('searchProfilesNotInCurrentChannel', () => {
        expect(Selectors.searchProfilesNotInCurrentChannel(testState, user2.username)).toEqual([user2]);
        expect(Selectors.searchProfilesNotInCurrentChannel(testState, user2.username, true)).toEqual([user2]);
    });

    it('searchProfilesInCurrentTeam', () => {
        expect(Selectors.searchProfilesInCurrentTeam(testState, user1.username)).toEqual([user1]);
        expect(Selectors.searchProfilesInCurrentTeam(testState, user1.username, true)).toEqual([]);
    });

    describe('searchProfilesInTeam', () => {
        it('searchProfilesInTeam without filter', () => {
            expect(Selectors.searchProfilesInTeam(testState, team1.id, user1.username)).toEqual([user1]);
            expect(Selectors.searchProfilesInTeam(testState, team1.id, user1.username, true)).toEqual([]);
        });
        it('searchProfilesInTeam with filter', () => {
            expect(Selectors.searchProfilesInTeam(testState, team1.id, user1.username, false, {role: 'system_admin'})).toEqual([user1]);
            expect(Selectors.searchProfilesInTeam(testState, team1.id, user1.username, false, {inactive: true})).toEqual([]);
            expect(Selectors.searchProfilesInTeam(testState, team1.id, user2.username, false, {active: true})).toEqual([]);
            expect(Selectors.searchProfilesInTeam(testState, team1.id, user1.username, false, {active: true})).toEqual([user1]);
        });
        it('getProfiles with multiple filters', () => {
            const users = [user7];
            expect(Selectors.searchProfilesInTeam(testState, team1.id, user7.username, false, {role: 'system_admin', inactive: true})).toEqual(users);
        });
    });

    it('searchProfilesNotInCurrentTeam', () => {
        expect(Selectors.searchProfilesNotInCurrentTeam(testState, user3.username)).toEqual([user3]);
        expect(Selectors.searchProfilesNotInCurrentTeam(testState, user3.username, true)).toEqual([user3]);
    });

    describe('searchProfilesWithoutTeam', () => {
        it('searchProfilesWithoutTeam without filter', () => {
            expect(Selectors.searchProfilesWithoutTeam(testState, user5.username, false, {})).toEqual([user5]);
            expect(Selectors.searchProfilesWithoutTeam(testState, user5.username, true, {})).toEqual([user5]);
        });
        it('searchProfilesWithoutTeam with filter', () => {
            expect(Selectors.searchProfilesWithoutTeam(testState, user6.username, false, {role: 'system_admin'})).toEqual([user6]);
            expect(Selectors.searchProfilesWithoutTeam(testState, user5.username, false, {inactive: true})).toEqual([]);
        });
    });
    it('searchProfilesInGroup', () => {
        expect(Selectors.searchProfilesInGroup(testState, group1.id, user5.username)).toEqual([]);
        expect(Selectors.searchProfilesInGroup(testState, group1.id, user1.username)).toEqual([user1]);
        expect(Selectors.searchProfilesInGroup(testState, group2.id, user2.username)).toEqual([user2]);
        expect(Selectors.searchProfilesInGroup(testState, group2.id, user3.username)).toEqual([user3]);
    });

    it('isCurrentUserSystemAdmin', () => {
        expect(Selectors.isCurrentUserSystemAdmin(testState)).toEqual(true);
    });

    it('getUserByUsername', () => {
        expect(Selectors.getUserByUsername(testState, user1.username)).toEqual(user1);
    });

    it('getUsersInVisibleDMs', () => {
        expect(Selectors.getUsersInVisibleDMs(testState)).toEqual([user2]);
    });

    it('getUserByEmail', () => {
        expect(Selectors.getUserByEmail(testState, user1.email)).toEqual(user1);
        expect(Selectors.getUserByEmail(testState, user2.email)).toEqual(user2);
    });

    it('makeGetProfilesInChannel', () => {
        const getProfilesInChannel = Selectors.makeGetProfilesInChannel();
        expect(getProfilesInChannel(testState, channel1.id)).toEqual([user1]);

        const users = [user1, user2].sort(sortByUsername);
        expect(getProfilesInChannel(testState, channel2.id)).toEqual(users);
        expect(getProfilesInChannel(testState, channel2.id, {active: true})).toEqual([user1]);
        expect(getProfilesInChannel(testState, channel2.id, {channel_roles: ['channel_admin']})).toEqual([]);
        expect(getProfilesInChannel(testState, channel2.id, {channel_roles: ['channel_user']})).toEqual([user2]);
        expect(getProfilesInChannel(testState, channel2.id, {channel_roles: ['channel_admin', 'channel_user']})).toEqual([user2]);
        expect(getProfilesInChannel(testState, channel2.id, {roles: ['system_admin'], channel_roles: ['channel_admin', 'channel_user']})).toEqual([user1, user2].sort(sortByUsername));

        expect(getProfilesInChannel(testState, 'nonexistentid')).toEqual([]);
        expect(getProfilesInChannel(testState, 'nonexistentid')).toEqual([]);
    });

    it('makeGetProfilesInChannel, unknown user id in channel', () => {
        const state = {
            ...testState,
            entities: {
                ...testState.entities,
                users: {
                    ...testState.entities.users,
                    profilesInChannel: {
                        ...testState.entities.users.profilesInChannel,
                        [channel1.id]: new Set([...testState.entities.users.profilesInChannel[channel1.id], 'unknown']),
                    },
                },
            },
        };

        const getProfilesInChannel = Selectors.makeGetProfilesInChannel();
        expect(getProfilesInChannel(state, channel1.id)).toEqual([user1]);
        expect(getProfilesInChannel(state, channel1.id, {})).toEqual([user1]);
    });

    it('makeGetProfilesNotInChannel', () => {
        const getProfilesNotInChannel = Selectors.makeGetProfilesNotInChannel();

        expect(getProfilesNotInChannel(testState, channel1.id)).toEqual([user2, user3].sort(sortByUsername));

        expect(getProfilesNotInChannel(testState, channel2.id)).toEqual([user4, user5].sort(sortByUsername));

        expect(getProfilesNotInChannel(testState, 'nonexistentid')).toEqual([]);
        expect(getProfilesNotInChannel(testState, 'nonexistentid')).toEqual([]);
    });

    it('makeGetProfilesByIdsAndUsernames', () => {
        const getProfilesByIdsAndUsernames = Selectors.makeGetProfilesByIdsAndUsernames();

        const testCases = [
            {input: {allUserIds: [], allUsernames: []}, output: []},
            {input: {allUserIds: ['nonexistentid'], allUsernames: ['nonexistentid']}, output: []},
            {input: {allUserIds: [user1.id], allUsernames: []}, output: [user1]},
            {input: {allUserIds: [user1.id]}, output: [user1]},
            {input: {allUserIds: [user1.id, 'nonexistentid']}, output: [user1]},
            {input: {allUserIds: [user1.id, user2.id]}, output: [user1, user2]},
            {input: {allUserIds: ['nonexistentid', user1.id, user2.id]}, output: [user1, user2]},
            {input: {allUserIds: [], allUsernames: [user1.username]}, output: [user1]},
            {input: {allUsernames: [user1.username]}, output: [user1]},
            {input: {allUsernames: [user1.username, 'nonexistentid']}, output: [user1]},
            {input: {allUsernames: [user1.username, user2.username]}, output: [user1, user2]},
            {input: {allUsernames: [user1.username, 'nonexistentid', user2.username]}, output: [user1, user2]},
            {input: {allUserIds: [user1.id], allUsernames: [user2.username]}, output: [user1, user2]},
            {input: {allUserIds: [user1.id, user2.id], allUsernames: [user3.username, user4.username]}, output: [user1, user2, user3, user4]},
            {input: {allUserIds: [user1.username, user2.username], allUsernames: [user3.id, user4.id]}, output: []},
        ];

        testCases.forEach((testCase) => {
            expect(getProfilesByIdsAndUsernames(testState, testCase.input as Parameters<typeof getProfilesByIdsAndUsernames>[1])).toEqual(testCase.output);
        });
    });

    describe('makeGetDisplayName and makeDisplayNameGetter', () => {
        const testUser1 = {
            ...user1,
            id: 'test_user_id',
            username: 'username',
            first_name: 'First',
            last_name: 'Last',
        };
        const newProfiles = {
            ...profiles,
            [testUser1.id]: testUser1,
        };
        it('Should show full name since preferences is being used and LockTeammateNameDisplay is false', () => {
            const newTestState = {
                entities: {
                    users: {profiles: newProfiles},
                    preferences: {
                        myPreferences: {
                            [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.NAME_NAME_FORMAT}`]: {
                                value: General.TEAMMATE_NAME_DISPLAY.SHOW_FULLNAME,
                            },
                        },
                    },
                    general: {
                        config: {
                            TeammateNameDisplay: General.TEAMMATE_NAME_DISPLAY.SHOW_USERNAME,
                            LockTeammateNameDisplay: 'false',
                        },
                        license: {
                            LockTeammateNameDisplay: 'true',
                        },
                    },
                },
            } as unknown as GlobalState;
            expect(Selectors.makeGetDisplayName()(newTestState, testUser1.id)).toEqual('First Last');
            expect(Selectors.makeDisplayNameGetter()(newTestState, false)(testUser1)).toEqual('First Last');
        });
        it('Should show show username since LockTeammateNameDisplay is true', () => {
            const newTestState = {
                entities: {
                    users: {profiles: newProfiles},
                    preferences: {
                        myPreferences: {
                            [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.NAME_NAME_FORMAT}`]: {
                                value: General.TEAMMATE_NAME_DISPLAY.SHOW_FULLNAME,
                            },
                        },
                    },
                    general: {
                        config: {
                            TeammateNameDisplay: General.TEAMMATE_NAME_DISPLAY.SHOW_USERNAME,
                            LockTeammateNameDisplay: 'true',
                        },
                        license: {
                            LockTeammateNameDisplay: 'true',
                        },
                    },
                },
            } as unknown as GlobalState;
            expect(Selectors.makeGetDisplayName()(newTestState, testUser1.id)).toEqual('username');
            expect(Selectors.makeDisplayNameGetter()(newTestState, false)(testUser1)).toEqual('username');
        });
        it('Should show full name since license is false', () => {
            const newTestState = {
                entities: {
                    users: {profiles: newProfiles},
                    preferences: {
                        myPreferences: {
                            [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.NAME_NAME_FORMAT}`]: {
                                value: General.TEAMMATE_NAME_DISPLAY.SHOW_FULLNAME,
                            },
                        },
                    },
                    general: {
                        config: {
                            TeammateNameDisplay: General.TEAMMATE_NAME_DISPLAY.SHOW_USERNAME,
                            LockTeammateNameDisplay: 'true',
                        },
                        license: {
                            LockTeammateNameDisplay: 'false',
                        },
                    },
                },
            } as unknown as GlobalState;
            expect(Selectors.makeGetDisplayName()(newTestState, testUser1.id)).toEqual('First Last');
            expect(Selectors.makeDisplayNameGetter()(newTestState, false)(testUser1)).toEqual('First Last');
        });
        it('Should show full name since license is not available', () => {
            const newTestState = {
                entities: {
                    users: {profiles: newProfiles},
                    preferences: {
                        myPreferences: {
                            [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.NAME_NAME_FORMAT}`]: {
                                value: General.TEAMMATE_NAME_DISPLAY.SHOW_FULLNAME,
                            },
                        },
                    },
                    general: {
                        config: {
                            TeammateNameDisplay: General.TEAMMATE_NAME_DISPLAY.SHOW_USERNAME,
                            LockTeammateNameDisplay: 'true',
                        },
                    },
                },
            } as GlobalState;
            expect(Selectors.makeGetDisplayName()(newTestState, testUser1.id)).toEqual('First Last');
            expect(Selectors.makeDisplayNameGetter()(newTestState, false)(testUser1)).toEqual('First Last');
        });
        it('Should show Full name since license is not available and lock teammate name display is false', () => {
            const newTestState = {
                entities: {
                    users: {profiles: newProfiles},
                    preferences: {
                        myPreferences: {
                            [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.NAME_NAME_FORMAT}`]: {
                                value: General.TEAMMATE_NAME_DISPLAY.SHOW_FULLNAME,
                            },
                        },
                    },
                    general: {
                        config: {
                            TeammateNameDisplay: General.TEAMMATE_NAME_DISPLAY.SHOW_USERNAME,
                            LockTeammateNameDisplay: 'false',
                        },
                    },
                },
            } as GlobalState;
            expect(Selectors.makeGetDisplayName()(newTestState, testUser1.id)).toEqual('First Last');
            expect(Selectors.makeDisplayNameGetter()(newTestState, false)(testUser1)).toEqual('First Last');
        });
        it('Should show username since no settings are available (falls back to default)', () => {
            const newTestState = {
                entities: {
                    users: {profiles: newProfiles},
                    preferences: {
                        myPreferences: {
                            [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.NAME_NAME_FORMAT}`]: {
                            },
                        },
                    },
                    general: {
                        config: {
                        },
                    },
                },
            } as GlobalState;
            expect(Selectors.makeGetDisplayName()(newTestState, testUser1.id)).toEqual('username');
            expect(Selectors.makeDisplayNameGetter()(newTestState, false)(testUser1)).toEqual('username');
        });
    });

    it('shouldShowTermsOfService', () => {
        const userId = 1234;

        // Test latest terms not accepted
        expect(Selectors.shouldShowTermsOfService({
            entities: {
                general: {
                    config: {
                        CustomTermsOfServiceId: '1',
                        EnableCustomTermsOfService: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                    },
                },
                users: {
                    currentUserId: userId,
                    profiles: {
                        [userId]: {id: userId, username: 'user', first_name: 'First', last_name: 'Last'},
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(true);

        // Test Feature disabled
        expect(Selectors.shouldShowTermsOfService({
            entities: {
                general: {
                    config: {
                        CustomTermsOfServiceId: '1',
                        EnableCustomTermsOfService: 'false',
                    },
                    license: {
                        IsLicensed: 'true',
                    },
                },
                users: {
                    currentUserId: userId,
                    profiles: {
                        [userId]: {id: userId, username: 'user', first_name: 'First', last_name: 'Last'},
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(false);

        // Test unlicensed
        expect(Selectors.shouldShowTermsOfService({
            entities: {
                general: {
                    config: {
                        CustomTermsOfServiceId: '1',
                        EnableCustomTermsOfService: 'true',
                    },
                    license: {
                        IsLicensed: 'false',
                    },
                },
                users: {
                    currentUserId: userId,
                    profiles: {
                        [userId]: {id: userId, username: 'user', first_name: 'First', last_name: 'Last'},
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(false);

        // Test terms already accepted
        expect(Selectors.shouldShowTermsOfService({
            entities: {
                general: {
                    config: {
                        CustomTermsOfServiceId: '1',
                        EnableCustomTermsOfService: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                    },
                },
                users: {
                    currentUserId: userId,
                    profiles: {
                        [userId]: {id: userId, username: 'user', first_name: 'First', last_name: 'Last', terms_of_service_id: '1', terms_of_service_create_at: new Date().getTime()},
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(false);

        // Test not logged in
        expect(Selectors.shouldShowTermsOfService({
            entities: {
                general: {
                    config: {
                        CustomTermsOfServiceId: '1',
                        EnableCustomTermsOfService: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                    },
                },
                users: {
                    currentUserId: userId,
                    profiles: {},
                },
            },
        } as unknown as GlobalState)).toEqual(false);
    });

    describe('currentUserHasAnAdminRole', () => {
        it('returns the expected result', () => {
            expect(Selectors.currentUserHasAnAdminRole(testState)).toEqual(true);
            const state = {
                ...testState,
                entities: {
                    ...testState.entities,
                    users: {
                        ...testState.entities.users,
                        currentUserId: user2.id,
                    },
                },
            };
            expect(Selectors.currentUserHasAnAdminRole(state)).toEqual(false);
        });
    });

    describe('filterProfiles', () => {
        it('no filter, return all users', () => {
            expect(Object.keys(Selectors.filterProfiles(profiles)).length).toEqual(7);
        });

        it('filter role', () => {
            const filter = {
                role: 'system_admin',
            };
            expect(Object.keys(Selectors.filterProfiles(profiles, filter)).length).toEqual(3);
        });

        it('filter roles', () => {
            const filter = {
                roles: ['system_admin'],
                team_roles: ['team_admin'],
            };

            const membership = TestHelper.fakeTeamMember(user3.id, team1.id);
            membership.scheme_admin = true;
            const memberships = {[user3.id]: membership};

            expect(Object.keys(Selectors.filterProfiles(profiles, filter, memberships)).length).toEqual(4);
        });

        it('exclude_roles', () => {
            const filter = {
                exclude_roles: ['system_admin'],
            };
            expect(Object.keys(Selectors.filterProfiles(profiles, filter)).length).toEqual(4);
        });

        it('exclude bots', () => {
            const filter = {
                exclude_bots: true,
            };
            const botUser = {
                ...user1,
                id: 'test_bot_id',
                username: 'botusername',
                first_name: '',
                last_name: '',
                is_bot: true,
            };
            const newProfiles = {
                ...profiles,
                [botUser.id]: botUser,
            };
            expect(Object.keys(Selectors.filterProfiles(newProfiles, filter)).length).toEqual(7);
        });

        it('filter inactive', () => {
            const filter = {
                inactive: true,
            };
            expect(Object.keys(Selectors.filterProfiles(profiles, filter)).length).toEqual(2);
        });

        it('filter active', () => {
            const filter = {
                active: true,
            };
            expect(Object.keys(Selectors.filterProfiles(profiles, filter)).length).toEqual(5);
        });
    });
});
