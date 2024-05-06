// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile, UsersState} from '@mattermost/types/users';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import {UserTypes, ChannelTypes} from 'mattermost-redux/action_types';
import reducer from 'mattermost-redux/reducers/entities/users';
import deepFreezeAndThrowOnMutation from 'mattermost-redux/utils/deep_freeze';

import {TestHelper} from 'utils/test_helper';

type ReducerState = ReturnType<typeof reducer>;

describe('Reducers.users', () => {
    describe('profilesInChannel', () => {
        it('initial state', () => {
            const state = undefined;
            const action = {type: undefined};
            const expectedState = {
                profilesInChannel: {},
            };

            const newState = reducer(state, action);
            expect(newState.profilesInChannel).toEqual(expectedState.profilesInChannel);
        });

        it('UserTypes.RECEIVED_PROFILE_IN_CHANNEL, no existing profiles', () => {
            const state = {
                profilesInChannel: {},
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILE_IN_CHANNEL,
                data: {
                    id: 'id',
                    user_id: 'user_id',
                },
            };
            const expectedState = {
                profilesInChannel: {
                    id: new Set().add('user_id'),
                },
            };

            const newState = reducer(state as ReducerState, action);
            expect(newState.profilesInChannel).toEqual(expectedState.profilesInChannel);
        });

        it('UserTypes.RECEIVED_PROFILE_IN_CHANNEL, existing profiles', () => {
            const state = {
                profilesInChannel: {
                    id: new Set().add('old_user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILE_IN_CHANNEL,
                data: {
                    id: 'id',
                    user_id: 'user_id',
                },
            };
            const expectedState = {
                profilesInChannel: {
                    id: new Set().add('old_user_id').add('user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };

            const newState = reducer(state as unknown as ReducerState, action);
            expect(newState.profilesInChannel).toEqual(expectedState.profilesInChannel);
        });

        it('UserTypes.RECEIVED_PROFILES_LIST_IN_CHANNEL, no existing profiles', () => {
            const state = {
                profilesInChannel: {},
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILES_LIST_IN_CHANNEL,
                id: 'id',
                data: [
                    {
                        id: 'user_id',
                    },
                    {
                        id: 'user_id_2',
                    },
                ],
            };
            const expectedState = {
                profilesInChannel: {
                    id: new Set().add('user_id').add('user_id_2'),
                },
            };

            const newState = reducer(state as ReducerState, action);
            expect(newState.profilesInChannel).toEqual(expectedState.profilesInChannel);
        });

        it('UserTypes.RECEIVED_PROFILES_LIST_IN_CHANNEL, existing profiles', () => {
            const state = {
                profilesInChannel: {
                    id: new Set().add('old_user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILES_LIST_IN_CHANNEL,
                id: 'id',
                data: [
                    {
                        id: 'user_id',
                    },
                    {
                        id: 'user_id_2',
                    },
                ],
            };
            const expectedState = {
                profilesInChannel: {
                    id: new Set().add('old_user_id').add('user_id').add('user_id_2'),
                    other_id: new Set().add('other_user_id'),
                },
            };

            const newState = reducer(state as unknown as ReducerState, action);
            expect(newState.profilesInChannel).toEqual(expectedState.profilesInChannel);
        });

        it('UserTypes.RECEIVED_PROFILES_IN_CHANNEL, no existing profiles', () => {
            const state = {
                profilesInChannel: {},
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILES_IN_CHANNEL,
                id: 'id',
                data: {
                    user_id: {
                        id: 'user_id',
                    },
                    user_id_2: {
                        id: 'user_id_2',
                    },
                },
            };
            const expectedState = {
                profilesInChannel: {
                    id: new Set().add('user_id').add('user_id_2'),
                },
            };

            const newState = reducer(state as ReducerState, action);
            expect(newState.profilesInChannel).toEqual(expectedState.profilesInChannel);
        });

        it('UserTypes.RECEIVED_PROFILES_IN_CHANNEL, existing profiles', () => {
            const state = {
                profilesInChannel: {
                    id: new Set().add('old_user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILES_IN_CHANNEL,
                id: 'id',
                data: {
                    user_id: {
                        id: 'user_id',
                    },
                    user_id_2: {
                        id: 'user_id_2',
                    },
                },
            };
            const expectedState = {
                profilesInChannel: {
                    id: new Set().add('old_user_id').add('user_id').add('user_id_2'),
                    other_id: new Set().add('other_user_id'),
                },
            };

            const newState = reducer(state as unknown as ReducerState, action);
            expect(newState.profilesInChannel).toEqual(expectedState.profilesInChannel);
        });

        it('UserTypes.RECEIVED_PROFILE_NOT_IN_CHANNEL, unknown user id', () => {
            const state = {
                profilesInChannel: {
                    id: new Set().add('old_user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILE_NOT_IN_CHANNEL,
                data: {
                    id: 'id',
                    user_id: 'unknkown_user_id',
                },
            };
            const expectedState = state;

            const newState = reducer(state as unknown as ReducerState, action);
            expect(newState.profilesInChannel).toEqual(expectedState.profilesInChannel);
        });

        it('UserTypes.RECEIVED_PROFILE_NOT_IN_CHANNEL, known user id', () => {
            const state = {
                profilesInChannel: {
                    id: new Set().add('old_user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILE_NOT_IN_CHANNEL,
                data: {
                    id: 'id',
                    user_id: 'old_user_id',
                },
            };
            const expectedState = {
                profilesInChannel: {
                    id: new Set(),
                    other_id: new Set().add('other_user_id'),
                },
            };

            const newState = reducer(state as unknown as ReducerState, action);
            expect(newState.profilesInChannel).toEqual(expectedState.profilesInChannel);
        });

        it('ChannelTypes.CHANNEL_MEMBER_REMOVED, unknown user id', () => {
            const state = {
                profilesInChannel: {
                    id: new Set().add('old_user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };
            const action = {
                type: ChannelTypes.CHANNEL_MEMBER_REMOVED,
                data: {
                    channel_id: 'id',
                    user_id: 'unknkown_user_id',
                },
            };
            const expectedState = state;

            const newState = reducer(state as unknown as ReducerState, action);
            expect(newState.profilesInChannel).toEqual(expectedState.profilesInChannel);
        });

        it('ChannelTypes.CHANNEL_MEMBER_REMOVED, known user id', () => {
            const state = {
                profilesInChannel: {
                    id: new Set().add('old_user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };
            const action = {
                type: ChannelTypes.CHANNEL_MEMBER_REMOVED,
                data: {
                    channel_id: 'id',
                    user_id: 'old_user_id',
                },
            };
            const expectedState = {
                profilesInChannel: {
                    id: new Set(),
                    other_id: new Set().add('other_user_id'),
                },
            };

            const newState = reducer(state as unknown as ReducerState, action);
            expect(newState.profilesInChannel).toEqual(expectedState.profilesInChannel);
        });

        it('UserTypes.LOGOUT_SUCCESS, existing profiles', () => {
            const state = {
                profilesInChannel: {
                    id: new Set().add('old_user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };
            const action = {
                type: UserTypes.LOGOUT_SUCCESS,
            };
            const expectedState = {
                profilesInChannel: {},
            };

            const newState = reducer(state as unknown as ReducerState, action);
            expect(newState.profilesInChannel).toEqual(expectedState.profilesInChannel);
        });
    });

    describe('profilesNotInChannel', () => {
        it('initial state', () => {
            const state = undefined;
            const action = {type: undefined};
            const expectedState = {
                profilesNotInChannel: {},
            };

            const newState = reducer(state, action);
            expect(newState.profilesNotInChannel).toEqual(expectedState.profilesNotInChannel);
        });

        it('UserTypes.RECEIVED_PROFILE_NOT_IN_CHANNEL, no existing profiles', () => {
            const state = {
                profilesNotInChannel: {},
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILE_NOT_IN_CHANNEL,
                data: {
                    id: 'id',
                    user_id: 'user_id',
                },
            };
            const expectedState = {
                profilesNotInChannel: {
                    id: new Set().add('user_id'),
                },
            };

            const newState = reducer(state as ReducerState, action);
            expect(newState.profilesNotInChannel).toEqual(expectedState.profilesNotInChannel);
        });

        it('UserTypes.RECEIVED_PROFILE_NOT_IN_CHANNEL, existing profiles', () => {
            const state = {
                profilesNotInChannel: {
                    id: new Set().add('old_user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILE_NOT_IN_CHANNEL,
                data: {
                    id: 'id',
                    user_id: 'user_id',
                },
            };
            const expectedState = {
                profilesNotInChannel: {
                    id: new Set().add('old_user_id').add('user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };

            const newState = reducer(state as unknown as ReducerState, action);
            expect(newState.profilesNotInChannel).toEqual(expectedState.profilesNotInChannel);
        });

        it('UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_CHANNEL, no existing profiles', () => {
            const state = {
                profilesNotInChannel: {},
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_CHANNEL,
                id: 'id',
                data: [
                    {
                        id: 'user_id',
                    },
                    {
                        id: 'user_id_2',
                    },
                ],
            };
            const expectedState = {
                profilesNotInChannel: {
                    id: new Set().add('user_id').add('user_id_2'),
                },
            };

            const newState = reducer(state as ReducerState, action);
            expect(newState.profilesNotInChannel).toEqual(expectedState.profilesNotInChannel);
        });

        it('UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_CHANNEL, existing profiles', () => {
            const state = {
                profilesNotInChannel: {
                    id: new Set().add('old_user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_CHANNEL,
                id: 'id',
                data: [
                    {
                        id: 'user_id',
                    },
                    {
                        id: 'user_id_2',
                    },
                ],
            };
            const expectedState = {
                profilesNotInChannel: {
                    id: new Set().add('old_user_id').add('user_id').add('user_id_2'),
                    other_id: new Set().add('other_user_id'),
                },
            };

            const newState = reducer(state as unknown as ReducerState, action);
            expect(newState.profilesNotInChannel).toEqual(expectedState.profilesNotInChannel);
        });

        it('UserTypes.RECEIVED_PROFILES_NOT_IN_CHANNEL, no existing profiles', () => {
            const state = {
                profilesNotInChannel: {},
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILES_NOT_IN_CHANNEL,
                id: 'id',
                data: {
                    user_id: {
                        id: 'user_id',
                    },
                    user_id_2: {
                        id: 'user_id_2',
                    },
                },
            };
            const expectedState = {
                profilesNotInChannel: {
                    id: new Set().add('user_id').add('user_id_2'),
                },
            };

            const newState = reducer(state as ReducerState, action);
            expect(newState.profilesNotInChannel).toEqual(expectedState.profilesNotInChannel);
        });

        it('UserTypes.RECEIVED_PROFILES_NOT_IN_CHANNEL, existing profiles', () => {
            const state = {
                profilesNotInChannel: {
                    id: new Set().add('old_user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILES_NOT_IN_CHANNEL,
                id: 'id',
                data: {
                    user_id: {
                        id: 'user_id',
                    },
                    user_id_2: {
                        id: 'user_id_2',
                    },
                },
            };
            const expectedState = {
                profilesNotInChannel: {
                    id: new Set().add('old_user_id').add('user_id').add('user_id_2'),
                    other_id: new Set().add('other_user_id'),
                },
            };

            const newState = reducer(state as unknown as ReducerState, action);
            expect(newState.profilesNotInChannel).toEqual(expectedState.profilesNotInChannel);
        });

        it('UserTypes.RECEIVED_PROFILE_IN_CHANNEL, unknown user id', () => {
            const state = {
                profilesNotInChannel: {
                    id: new Set().add('old_user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILE_IN_CHANNEL,
                data: {
                    id: 'id',
                    user_id: 'unknkown_user_id',
                },
            };
            const expectedState = state;

            const newState = reducer(state as unknown as ReducerState, action);
            expect(newState.profilesNotInChannel).toEqual(expectedState.profilesNotInChannel);
        });

        it('UserTypes.RECEIVED_PROFILE_IN_CHANNEL, known user id', () => {
            const state = {
                profilesNotInChannel: {
                    id: new Set().add('old_user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILE_IN_CHANNEL,
                data: {
                    id: 'id',
                    user_id: 'old_user_id',
                },
            };
            const expectedState = {
                profilesNotInChannel: {
                    id: new Set(),
                    other_id: new Set().add('other_user_id'),
                },
            };

            const newState = reducer(state as unknown as ReducerState, action);
            expect(newState.profilesNotInChannel).toEqual(expectedState.profilesNotInChannel);
        });

        it('ChannelTypes.CHANNEL_MEMBER_ADDED, unknown user id', () => {
            const state = {
                profilesNotInChannel: {
                    id: new Set().add('old_user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };
            const action = {
                type: ChannelTypes.CHANNEL_MEMBER_ADDED,
                data: {
                    channel_id: 'id',
                    user_id: 'unknkown_user_id',
                },
            };
            const expectedState = state;

            const newState = reducer(state as unknown as ReducerState, action);
            expect(newState.profilesNotInChannel).toEqual(expectedState.profilesNotInChannel);
        });

        it('ChannelTypes.CHANNEL_MEMBER_ADDED, known user id', () => {
            const state = {
                profilesNotInChannel: {
                    id: new Set().add('old_user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };
            const action = {
                type: ChannelTypes.CHANNEL_MEMBER_ADDED,
                data: {
                    channel_id: 'id',
                    user_id: 'old_user_id',
                },
            };
            const expectedState = {
                profilesNotInChannel: {
                    id: new Set(),
                    other_id: new Set().add('other_user_id'),
                },
            };

            const newState = reducer(state as unknown as ReducerState, action);
            expect(newState.profilesNotInChannel).toEqual(expectedState.profilesNotInChannel);
        });

        it('UserTypes.LOGOUT_SUCCESS, existing profiles', () => {
            const state = {
                profilesNotInChannel: {
                    id: new Set().add('old_user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };
            const action = {
                type: UserTypes.LOGOUT_SUCCESS,
            };
            const expectedState = {
                profilesNotInChannel: {},
            };

            const newState = reducer(state as unknown as ReducerState, action);
            expect(newState.profilesNotInChannel).toEqual(expectedState.profilesNotInChannel);
        });

        it('UserTypes.RECEIVED_FILTERED_USER_STATS', () => {
            const state = {};
            const action = {
                type: UserTypes.RECEIVED_FILTERED_USER_STATS,
                data: {total_users_count: 1},
            };
            const expectedState = {
                filteredStats: {total_users_count: 1},
            };

            const newState = reducer(state as ReducerState, action);
            expect(newState.filteredStats).toEqual(expectedState.filteredStats);
        });
    });
    describe('profilesNotInGroup', () => {
        it('initial state', () => {
            const state = undefined;
            const action = {type: undefined};
            const expectedState = {
                profilesNotInGroup: {},
            };

            const newState = reducer(state, action);
            expect(newState.profilesNotInGroup).toEqual(expectedState.profilesNotInGroup);
        });

        it('UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_GROUP, no existing profiles', () => {
            const state = {
                profilesNotInGroup: {},
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_GROUP,
                id: 'id',
                data: [
                    {
                        id: 'user_id',
                    },
                    {
                        id: 'user_id_2',
                    },
                ],
            };
            const expectedState = {
                profilesNotInGroup: {
                    id: new Set().add('user_id').add('user_id_2'),
                },
            };

            const newState = reducer(state as ReducerState, action);
            expect(newState.profilesNotInGroup).toEqual(expectedState.profilesNotInGroup);
        });

        it('UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_GROUP, existing profiles', () => {
            const state = {
                profilesNotInGroup: {
                    id: new Set().add('old_user_id'),
                    other_id: new Set().add('other_user_id'),
                },
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_GROUP,
                id: 'id',
                data: [
                    {
                        id: 'user_id',
                    },
                    {
                        id: 'user_id_2',
                    },
                ],
            };
            const expectedState = {
                profilesNotInGroup: {
                    id: new Set().add('old_user_id').add('user_id').add('user_id_2'),
                    other_id: new Set().add('other_user_id'),
                },
            };

            const newState = reducer(state as unknown as ReducerState, action);
            expect(newState.profilesNotInGroup).toEqual(expectedState.profilesNotInGroup);
        });

        it('UserTypes.RECEIVED_PROFILES_FOR_GROUP, existing profiles', () => {
            const state = {
                profilesNotInGroup: {
                    id: new Set().add('user_id').add('user_id_2'),
                    other_id: new Set().add('other_user_id'),
                },
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILES_FOR_GROUP,
                id: 'id',
                data: [
                    {
                        user_id: 'user_id',
                    },
                ],
            };
            const expectedState = {
                profilesNotInGroup: {
                    id: new Set().add('user_id_2'),
                    other_id: new Set().add('other_user_id'),
                },
            };

            const newState = reducer(state as unknown as ReducerState, action);
            expect(newState.profilesNotInGroup).toEqual(expectedState.profilesNotInGroup);
        });
    });

    describe('profiles', () => {
        function sanitizeUser(user: UserProfile) {
            const sanitized = {
                ...user,
                email: '',
                first_name: '',
                last_name: '',
                auth_service: '',
            };

            Reflect.deleteProperty(sanitized, 'email_verify');
            Reflect.deleteProperty(sanitized, 'last_password_update');
            Reflect.deleteProperty(sanitized, 'notify_props');
            Reflect.deleteProperty(sanitized, 'terms_of_service_id');
            Reflect.deleteProperty(sanitized, 'terms_of_service_create_at');

            return sanitized;
        }

        for (const actionType of [UserTypes.RECEIVED_ME, UserTypes.RECEIVED_PROFILE]) {
            test(`should store a new user (${actionType})`, () => {
                const user1 = TestHelper.getUserMock({id: 'user_id1'});
                const user2 = TestHelper.getUserMock({id: 'user_id2'});

                const state = deepFreezeAndThrowOnMutation({
                    profiles: {
                        [user1.id]: user1,
                    },
                });

                const nextState = reducer(state, {
                    type: actionType,
                    data: user2,
                });

                expect(nextState.profiles).toEqual({
                    [user1.id]: user1,
                    [user2.id]: user2,
                });
            });

            test(`should update an existing user (${actionType})`, () => {
                const user1 = TestHelper.getUserMock({id: 'user_id1'});

                const state = deepFreezeAndThrowOnMutation({
                    profiles: {
                        [user1.id]: user1,
                    },
                });

                const nextState = reducer(state, {
                    type: actionType,
                    data: {
                        ...user1,
                        username: 'a different username',
                    },
                });

                expect(nextState.profiles).toEqual({
                    [user1.id]: {
                        ...user1,
                        username: 'a different username',
                    },
                });
            });

            test(`should remove remote_id when not set anymore (${actionType})`, () => {
                const user1 = TestHelper.getUserMock({id: 'user_id1', remote_id: 'abcdef'});
                const user1WithoutRemoteId = TestHelper.getUserMock({id: 'user_id1'});

                const state = deepFreezeAndThrowOnMutation({
                    profiles: {
                        [user1.id]: user1,
                    },
                });

                const nextState = reducer(state, {
                    type: actionType,
                    data: user1WithoutRemoteId,
                });

                expect(nextState.profiles).toEqual({
                    [user1.id]: user1WithoutRemoteId,
                });
            });

            test(`should not overwrite unsanitized data with sanitized data (${actionType})`, () => {
                const user1 = TestHelper.getUserMock({
                    id: 'user_id1',
                    email: 'user1@example.com',
                    first_name: 'User',
                    last_name: 'One',
                    auth_service: 'saml',
                });

                const state = deepFreezeAndThrowOnMutation({
                    profiles: {
                        [user1.id]: user1,
                    },
                });

                const nextState = reducer(state, {
                    type: actionType,
                    data: {
                        ...sanitizeUser(user1),
                        username: 'a different username',
                    },
                });

                expect(nextState.profiles).toEqual({
                    [user1.id]: {
                        ...user1,
                        username: 'a different username',
                    },
                });
                expect(nextState.profiles[user1.id].email).toBe(user1.email);
                expect(nextState.profiles[user1.id].auth_service).toBe(user1.auth_service);
            });

            test(`should return the same state when given an identical user object (${actionType})`, () => {
                const user1 = TestHelper.getUserMock({id: 'user_id1'});

                const state = deepFreezeAndThrowOnMutation({
                    profiles: {
                        [user1.id]: user1,
                    },
                });

                const nextState = reducer(state, {
                    type: actionType,
                    data: user1,
                });

                expect(nextState.profiles).toBe(state.profiles);
            });

            test(`should return the same state when given an sanitized but otherwise identical user object (${actionType})`, () => {
                const user1 = TestHelper.getUserMock({
                    id: 'user_id1',
                    email: 'user1@example.com',
                    first_name: 'User',
                    last_name: 'One',
                    auth_service: 'saml',
                });

                const state = deepFreezeAndThrowOnMutation({
                    profiles: {
                        [user1.id]: user1,
                    },
                });

                const nextState = reducer(state, {
                    type: actionType,
                    data: sanitizeUser(user1),
                });

                expect(nextState.profiles).toBe(state.profiles);
            });
        }

        for (const actionType of [UserTypes.RECEIVED_PROFILES, UserTypes.RECEIVED_PROFILES_LIST]) {
            function usersToData(users: UserProfile[]) {
                if (actionType === UserTypes.RECEIVED_PROFILES) {
                    const userMap: IDMappedObjects<UserProfile> = {};
                    for (const user of users) {
                        userMap[user.id] = user;
                    }
                    return userMap;
                }

                return users;
            }

            test(`should store new users (${actionType})`, () => {
                const user1 = TestHelper.getUserMock({id: 'user_id1'});
                const user2 = TestHelper.getUserMock({id: 'user_id2'});
                const user3 = TestHelper.getUserMock({id: 'user_id3'});

                const state = deepFreezeAndThrowOnMutation({
                    profiles: {
                        [user1.id]: user1,
                    },
                });

                const nextState = reducer(state, {
                    type: actionType,
                    data: usersToData([user2, user3]),
                });

                expect(nextState.profiles).toEqual({
                    [user1.id]: user1,
                    [user2.id]: user2,
                    [user3.id]: user3,
                });
            });

            test(`should update existing users (${actionType})`, () => {
                const user1 = TestHelper.getUserMock({id: 'user_id1'});
                const user2 = TestHelper.getUserMock({id: 'user_id2'});
                const user3 = TestHelper.getUserMock({id: 'user_id3'});

                const state = deepFreezeAndThrowOnMutation({
                    profiles: {
                        [user1.id]: user1,
                        [user2.id]: user2,
                        [user3.id]: user3,
                    },
                });

                const newUser1 = {
                    ...user1,
                    username: 'a different username',
                };
                const newUser2 = {
                    ...user2,
                    nickname: 'a different nickname',
                };

                const nextState = reducer(state, {
                    type: actionType,
                    data: usersToData([newUser1, newUser2]),
                });

                expect(nextState.profiles).toEqual({
                    [user1.id]: newUser1,
                    [user2.id]: newUser2,
                    [user3.id]: user3,
                });
            });

            test(`should not overwrite unsanitized data with sanitized data (${actionType})`, () => {
                const user1 = TestHelper.getUserMock({
                    id: 'user_id1',
                    email: 'user1@example.com',
                    first_name: 'User',
                    last_name: 'One',
                    auth_service: 'saml',
                });
                const user2 = TestHelper.getUserMock({id: 'user_id2'});

                const state = deepFreezeAndThrowOnMutation({
                    profiles: {
                        [user1.id]: user1,
                    },
                });

                const newUser1 = {
                    ...sanitizeUser(user1),
                    username: 'a different username',
                };
                const newUser2 = {
                    ...sanitizeUser(user2),
                    nickname: 'a different nickname',
                };

                const nextState = reducer(state, {
                    type: actionType,
                    data: usersToData([newUser1, newUser2]),
                });

                expect(nextState.profiles).toEqual({
                    [user1.id]: {
                        ...user1,
                        username: 'a different username',
                    },
                    [user2.id]: newUser2,
                });
                expect(nextState.profiles[user1.id].email).toBe(user1.email);
                expect(nextState.profiles[user1.id].auth_service).toBe(user1.auth_service);
            });

            test(`should return the same state when given identical user objects (${actionType})`, () => {
                const user1 = TestHelper.getUserMock({id: 'user_id1'});
                const user2 = TestHelper.getUserMock({id: 'user_id2'});

                const state = deepFreezeAndThrowOnMutation({
                    profiles: {
                        [user1.id]: user1,
                        [user2.id]: user2,
                    },
                });

                const nextState = reducer(state, {
                    type: actionType,
                    data: usersToData([user1, user2]),
                });

                expect(nextState.profiles).toBe(state.profiles);
            });

            test(`should return the same state when given an sanitized but otherwise identical user object (${actionType})`, () => {
                const user1 = TestHelper.getUserMock({
                    id: 'user_id1',
                    email: 'user1@example.com',
                    first_name: 'User',
                    last_name: 'One',
                    auth_service: 'saml',
                });
                const user2 = TestHelper.getUserMock({id: 'user_id2'});

                const state = deepFreezeAndThrowOnMutation({
                    profiles: {
                        [user1.id]: user1,
                        [user2.id]: user2,
                    },
                });

                const nextState = reducer(state, {
                    type: actionType,
                    data: usersToData([sanitizeUser(user1), sanitizeUser(user2)]),
                });

                expect(nextState.profiles).toBe(state.profiles);
            });
        }

        test('UserTypes.RECEIVED_PROFILES_LIST, should merge existing users with new ones', () => {
            const firstUser = TestHelper.getUserMock({id: 'first_user_id'});
            const secondUser = TestHelper.getUserMock({id: 'seocnd_user_id'});
            const thirdUser = TestHelper.getUserMock({id: 'third_user_id'});
            const partialUpdatedFirstUser = {
                ...firstUser,
                update_at: 123456789,
            };
            Reflect.deleteProperty(partialUpdatedFirstUser, 'email');
            Reflect.deleteProperty(partialUpdatedFirstUser, 'notify_props');
            const state = {
                profiles: {
                    first_user_id: firstUser,
                    second_user_id: secondUser,
                },
            };
            const action = {
                type: UserTypes.RECEIVED_PROFILES_LIST,
                data: [
                    partialUpdatedFirstUser,
                    thirdUser,
                ],
            };
            const {profiles: newProfiles} = reducer(state as unknown as ReducerState, action);

            expect(newProfiles.first_user_id).toEqual({...firstUser, ...partialUpdatedFirstUser});
            expect(newProfiles.second_user_id).toEqual(secondUser);
            expect(newProfiles.third_user_id).toEqual(thirdUser);
        });
    });

    test('PROFILE_NO_LONGER_VISIBLE should remove references to users from state', () => {
        const user = TestHelper.getUserMock({id: 'user'});

        let state: UsersState = {
            currentUserId: '',
            dndEndTimes: {},
            mySessions: [],
            myAudits: [],
            myUserAccessTokens: {},
            profiles: {
                user,
            },
            profilesInTeam: {
                team1: new Set([user.id]),
            },
            profilesNotInTeam: {
                team2: new Set([user.id]),
            },
            profilesWithoutTeam: new Set([user.id]),
            profilesInChannel: {
                channel1: new Set([user.id]),
            },
            profilesNotInChannel: {
                channel2: new Set([user.id]),
            },
            profilesInGroup: {
                group1: new Set([user.id]),
            },
            profilesNotInGroup: {
                group2: new Set([user.id]),
            },
            statuses: {
                [user.id]: 'online',
            },
            isManualStatus: {
                [user.id]: true,
            },
            stats: {},
            filteredStats: {
                total_users_count: 0,
            },
            lastActivity: {},
        };
        state = deepFreezeAndThrowOnMutation(state);

        const nextState = reducer(state, {
            type: UserTypes.PROFILE_NO_LONGER_VISIBLE,
            data: {
                user_id: user.id,
            },
        });

        expect(nextState).toEqual({
            currentUserId: '',
            dndEndTimes: {},
            mySessions: [],
            myAudits: [],
            myUserAccessTokens: {},
            profiles: {},
            profilesInTeam: {
                team1: new Set(),
            },
            profilesNotInTeam: {
                team2: new Set(),
            },
            profilesWithoutTeam: new Set(),
            profilesInChannel: {
                channel1: new Set(),
            },
            profilesNotInChannel: {
                channel2: new Set(),
            },
            profilesInGroup: {
                group1: new Set(),
            },
            profilesNotInGroup: {
                group2: new Set(),
            },
            statuses: {},
            isManualStatus: {},
            stats: {},
            filteredStats: {
                total_users_count: 0,
            },
            lastActivity: {},
        });
    });
});

describe('dndEndTimes', () => {
    const initialState = {} as UsersState;

    test('should return the initial state', () => {
        expect(reducer(initialState, {} as any).dndEndTimes).toEqual({});
        expect(reducer(undefined, {} as any).dndEndTimes).toEqual({});

        const usersState1 = deepFreezeAndThrowOnMutation({
            dndEndTimes: {},
        }) as UsersState;
        expect(reducer(usersState1, {} as any).dndEndTimes).toBe(usersState1.dndEndTimes);

        const usersState2 = deepFreezeAndThrowOnMutation({
            dndEndTimes: {
                test_user_id: 123456789,
            },
        }) as UsersState;
        expect(reducer(usersState2, {} as any).dndEndTimes).toBe(usersState2.dndEndTimes);
    });

    test('should store the dnd end time', () => {
        const action1 = {
            type: UserTypes.RECEIVED_DND_END_TIMES,
            data: {
                test_user_id: 123456789,
            },
        };
        expect(reducer(initialState, action1).dndEndTimes).toEqual({
            test_user_id: 123456789,
        });

        const state = deepFreezeAndThrowOnMutation({
            dndEndTimes: {
                test_user_id: 123456789,
            },
        }) as UsersState;
        const action2 = {
            type: UserTypes.RECEIVED_DND_END_TIMES,
            data: {
                test_user_id: 987654321,
            },
        };
        expect(reducer(state, action2).dndEndTimes).toEqual({
            test_user_id: 987654321,
        });
    });

    test('should store the dnd end time for multiple users', () => {
        const action1 = {
            type: UserTypes.RECEIVED_DND_END_TIMES,
            data: {
                test_user_id: 123456789,
                test_user_id_2: 987654321,
            },
        };
        expect(reducer(initialState, action1).dndEndTimes).toEqual({
            test_user_id: 123456789,
            test_user_id_2: 987654321,
        });

        const state = deepFreezeAndThrowOnMutation({
            dndEndTimes: {
                test_user_id: 1,
                test_user_id_2: 2,
                test_user_id_4: 4,
            },
        }) as UsersState;
        const action2 = {
            type: UserTypes.RECEIVED_DND_END_TIMES,
            data: {
                test_user_id: 10,
                test_user_id_2: 20,
                test_user_id_3: 30,
            },
        };
        expect(reducer(state, action2).dndEndTimes).toEqual({
            test_user_id: 10,
            test_user_id_2: 20,
            test_user_id_3: 30,
            test_user_id_4: 4,
        });
    });
});

describe('statuses', () => {
    const initialState = {} as UsersState;

    test('should return the initial state', () => {
        expect(reducer(initialState, {} as any).statuses).toEqual({});
        expect(reducer(undefined, {} as any).statuses).toEqual({});

        const usersState1 = deepFreezeAndThrowOnMutation({
            statuses: {
                test_user_id: 'online',
            },
        }) as UsersState;
        expect(reducer(usersState1, {} as any).statuses).toBe(usersState1.statuses);
    });

    test('should store the status', () => {
        const action1 = {
            type: UserTypes.RECEIVED_STATUSES,
            data: {
                test_user_id: 'away',
            },
        };
        expect(reducer(initialState, action1).statuses).toEqual({
            test_user_id: 'away',
        });

        const state = deepFreezeAndThrowOnMutation({
            statuses: {
                test_user_id: 'away',
            },
        }) as UsersState;
        const action2 = {
            type: UserTypes.RECEIVED_STATUSES,
            data: {
                test_user_id: 'dnd',
            },
        };
        expect(reducer(state, action2).statuses).toEqual({
            test_user_id: 'dnd',
        });
    });

    test('should store the status for multiple users', () => {
        const action1 = {
            type: UserTypes.RECEIVED_STATUSES,
            data: {
                test_user_id: 'away',
                test_user_id_2: 'dnd',
            },
        };
        expect(reducer(initialState, action1).statuses).toEqual({
            test_user_id: 'away',
            test_user_id_2: 'dnd',
        });

        const state = deepFreezeAndThrowOnMutation({
            statuses: {
                test_user_id: 'away',
                test_user_id_2: 'dnd',
                test_user_id_4: 'offline',
            },
        }) as UsersState;
        const action2 = {
            type: UserTypes.RECEIVED_STATUSES,
            data: {
                test_user_id: 'online',
                test_user_id_2: 'offline',
                test_user_id_3: 'away',
            },
        };
        expect(reducer(state, action2).statuses).toEqual({
            test_user_id: 'online',
            test_user_id_2: 'offline',
            test_user_id_3: 'away',
            test_user_id_4: 'offline',
        });
    });
});

describe('isManualStatus', () => {
    const initialState = {} as UsersState;

    test('should return the initial state', () => {
        expect(reducer(initialState, {} as any).isManualStatus).toEqual({});
        expect(reducer(undefined, {} as any).isManualStatus).toEqual({});

        const usersState1 = deepFreezeAndThrowOnMutation({
            isManualStatus: {
                test_user_id: true,
            },
        }) as UsersState;
        expect(reducer(usersState1, {} as any).isManualStatus).toBe(usersState1.isManualStatus);
    });

    test('should store the isManualStatus', () => {
        const action1 = {
            type: UserTypes.RECEIVED_STATUSES_IS_MANUAL,
            data: {
                test_user_id: true,
            },
        };
        expect(reducer(initialState, action1).isManualStatus).toEqual({
            test_user_id: true,
        });

        const state = deepFreezeAndThrowOnMutation({
            isManualStatus: {
                test_user_id: false,
            },
        }) as UsersState;
        const action2 = {
            type: UserTypes.RECEIVED_STATUSES_IS_MANUAL,
            data: {
                test_user_id: true,
            },
        };
        expect(reducer(state, action2).isManualStatus).toEqual({
            test_user_id: true,
        });
    });
});

describe('lastActivity', () => {
    const initialState = {} as UsersState;

    test('should return the initial state', () => {
        expect(reducer(initialState, {} as any).lastActivity).toEqual({});
        expect(reducer(undefined, {} as any).lastActivity).toEqual({});

        const state = deepFreezeAndThrowOnMutation({
            lastActivity: {
                test_user_id: 123456789,
            },
        }) as UsersState;
        expect(reducer(state, {} as any).lastActivity).toBe(state.lastActivity);
    });

    test('should store the last activity', () => {
        const action1 = {
            type: UserTypes.RECEIVED_LAST_ACTIVITIES,
            data: {
                test_user_id: 123456789,
            },
        };
        expect(reducer(initialState, action1).lastActivity).toEqual({
            test_user_id: 123456789,
        });

        const state = deepFreezeAndThrowOnMutation({
            lastActivity: {
                test_user_id: 123456789,
            },
        }) as UsersState;
        const action2 = {
            type: UserTypes.RECEIVED_LAST_ACTIVITIES,
            data: {
                test_user_id: 987654321,
            },
        };
        expect(reducer(state, action2).lastActivity).toEqual({
            test_user_id: 987654321,
        });
    });

    test('should store the last activity for multiple users', () => {
        const action1 = {
            type: UserTypes.RECEIVED_LAST_ACTIVITIES,
            data: {
                test_user_id: 123456789,
                test_user_id_2: 987654321,
            },
        };
        expect(reducer(initialState, action1).lastActivity).toEqual({
            test_user_id: 123456789,
            test_user_id_2: 987654321,
        });

        const state = deepFreezeAndThrowOnMutation({
            lastActivity: {
                test_user_id: 1,
                test_user_id_2: 2,
                test_user_id_4: 4,
            },
        }) as UsersState;
        const action2 = {
            type: UserTypes.RECEIVED_LAST_ACTIVITIES,
            data: {
                test_user_id: 10,
                test_user_id_2: 20,
                test_user_id_3: 30,
            },
        };
        expect(reducer(state, action2).lastActivity).toEqual({
            test_user_id: 10,
            test_user_id_2: 20,
            test_user_id_3: 30,
            test_user_id_4: 4,
        });
    });
});
