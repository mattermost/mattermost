// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserTypes, ChannelTypes} from 'mattermost-redux/action_types';
import {GenericAction} from 'mattermost-redux/types/actions';
import reducer from 'mattermost-redux/reducers/entities/users';
type ReducerState = ReturnType<typeof reducer>;

describe('Reducers.users', () => {
    describe('profilesInChannel', () => {
        it('initial state', () => {
            const state = undefined;
            const action = {};
            const expectedState = {
                profilesInChannel: {},
            };

            const newState = reducer(state, action as GenericAction);
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
            const action = {};
            const expectedState = {
                profilesNotInChannel: {},
            };

            const newState = reducer(state, action as GenericAction);
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
            const action = {};
            const expectedState = {
                profilesNotInGroup: {},
            };

            const newState = reducer(state, action as GenericAction);
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
});
