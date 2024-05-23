// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import store from 'stores/redux_store';

import mockStore from 'tests/test_store';
import {TestHelper} from 'utils/test_helper';

import SearchChannelWithPermissionsProvider from './search_channel_with_permissions_provider';

const getState = store.getState;

jest.mock('stores/redux_store', () => ({
    dispatch: jest.fn(),
    getState: jest.fn(),
}));

describe('components/SearchChannelWithPermissionsProvider', () => {
    const defaultState = {
        entities: {
            general: {
                config: {},
            },
            teams: {
                currentTeamId: 'someTeamId',
                myMembers: {
                    someTeamId: {
                        roles: '',
                    },
                },
            },
            channels: {
                myMembers: {
                    somePublicMemberChannelId: {
                    },
                    somePrivateMemberChannelId: {
                    },
                    someDirectConversation: {
                    },
                    someGroupConversation: {
                    },
                },
                roles: {
                    somePublicMemberChannelId: new Set<string>(),
                    somePrivateMemberChannelId: new Set<string>(),
                    someDirectConversation: new Set<string>(),
                    someGroupConversation: new Set<string>(),
                },
                channels: {
                    somePublicMemberChannelId: TestHelper.getChannelMock({
                        id: 'somePublicMemberChannelId',
                        type: 'O',
                        name: 'some-public-member-channel',
                        display_name: 'Some Public Member Channel',
                        delete_at: 0,
                    }),
                    somePrivateMemberChannelId: TestHelper.getChannelMock({
                        id: 'somePrivateMemberChannelId',
                        type: 'P',
                        name: 'some-private-member-channel',
                        display_name: 'Some Private Member Channel',
                        delete_at: 0,
                    }),
                    somePublicNonMemberChannelId: TestHelper.getChannelMock({
                        id: 'somePublicNonMemberChannelId',
                        type: 'O',
                        name: 'some-public-non-member-channel',
                        display_name: 'Some Public Non-Member Channel',
                        delete_at: 0,
                    }),
                    somePrivateNonMemberChannelId: TestHelper.getChannelMock({
                        id: 'somePrivateNonMemberChannelId',
                        type: 'P',
                        name: 'some-private=non-member-channel',
                        display_name: 'Some Private Non-Member Channel',
                        delete_at: 0,
                    }),
                    someDirectConversation: TestHelper.getChannelMock({
                        id: 'someDirectConversation',
                        type: 'D',
                        name: 'some-direct-conversation',
                        display_name: 'Some Direct Conversation',
                        delete_at: 0,
                    }),
                    someGroupConversation: TestHelper.getChannelMock({
                        id: 'someGroupConversation',
                        type: 'G',
                        name: 'some-group-conversation',
                        display_name: 'Some Group Conversation',
                        delete_at: 0,
                    }),
                },
                channelsInTeam: {
                    someTeamId: new Set([
                        'somePublicMemberChannelId',
                        'somePrivateMemberChannelId',
                        'somePublicNonMemberChannelId',
                        'somePrivateNonMemberChannelId',
                        'someDirectConversation',
                        'someGroupConversation',
                    ]),
                },
            },
            roles: {
                roles: {
                    public_channels_manager: {
                        permissions: ['manage_public_channel_members'],
                    },
                    private_channels_manager: {
                        permissions: ['manage_private_channel_members'],
                    },
                },
            },
            users: {
                profiles: {},
            },
        },
    };

    let searchProvider: SearchChannelWithPermissionsProvider;

    beforeEach(() => {
        const channelSearchFunc = jest.fn();
        searchProvider = new SearchChannelWithPermissionsProvider(channelSearchFunc);
    });

    it('should show public channels if user has public channel manage permission', () => {
        const roles = 'public_channels_manager';
        const resultsCallback = jest.fn();

        const state = {
            ...defaultState,
            entities: {
                ...defaultState.entities,
                teams: {
                    currentTeamId: 'someTeamId',
                    myMembers: {
                        someTeamId: {
                            roles,
                        },
                    },
                },
            },
        };

        const store = mockStore(state);

        getState.mockImplementation(store.getState);

        const searchText = 'some';
        searchProvider.handlePretextChanged(searchText, resultsCallback);
        expect(resultsCallback).toHaveBeenCalled();
        const args = resultsCallback.mock.calls[0][0];
        expect(args.items[0].channel.id).toEqual('somePublicMemberChannelId');
        expect(args.items.length).toEqual(1);
    });

    it('should show private channels if user has private channel manage permission', () => {
        const roles = 'private_channels_manager';
        const resultsCallback = jest.fn();

        const state = {
            ...defaultState,
            entities: {
                ...defaultState.entities,
                teams: {
                    currentTeamId: 'someTeamId',
                    myMembers: {
                        someTeamId: {
                            roles,
                        },
                    },
                },
            },
        };

        const store = mockStore(state);

        getState.mockImplementation(store.getState);

        const searchText = 'some';
        searchProvider.handlePretextChanged(searchText, resultsCallback);
        expect(resultsCallback).toHaveBeenCalled();
        const args = resultsCallback.mock.calls[0][0];

        expect(args.items[0].channel.id).toEqual('somePrivateMemberChannelId');
        expect(args.items.length).toEqual(1);
    });

    it('should show both public and private channels if user has public and private channel manage permission', () => {
        const roles = 'public_channels_manager private_channels_manager';
        const resultsCallback = jest.fn();

        const state = {
            ...defaultState,
            entities: {
                ...defaultState.entities,
                teams: {
                    currentTeamId: 'someTeamId',
                    myMembers: {
                        someTeamId: {
                            roles,
                        },
                    },
                },
            },
        };

        const store = mockStore(state);

        getState.mockImplementation(store.getState);

        const searchText = 'some';
        searchProvider.handlePretextChanged(searchText, resultsCallback);
        expect(resultsCallback).toHaveBeenCalled();
        const args = resultsCallback.mock.calls[0][0];

        expect(args.items[0].channel.id).toEqual('somePublicMemberChannelId');
        expect(args.items[1].channel.id).toEqual('somePrivateMemberChannelId');
        expect(args.items.length).toEqual(2);
    });

    it('should show nothing if the user does not have permissions to manage channels', () => {
        const roles = '';
        const resultsCallback = jest.fn();

        const state = {
            ...defaultState,
            entities: {
                ...defaultState.entities,
                teams: {
                    currentTeamId: 'someTeamId',
                    myMembers: {
                        someTeamId: {
                            roles,
                        },
                    },
                },
            },
        };

        const store = mockStore(state);

        getState.mockImplementation(store.getState);

        const searchText = 'some';
        searchProvider.handlePretextChanged(searchText, resultsCallback);
        expect(resultsCallback).toHaveBeenCalled();
        const args = resultsCallback.mock.calls[0][0];

        expect(args.items.length).toEqual(0);
    });

    it('should show nothing if the search does not match', () => {
        const roles = 'public_channels_manager private_channels_manager';
        const resultsCallback = jest.fn();

        const state = {
            ...defaultState,
            entities: {
                ...defaultState.entities,
                teams: {
                    currentTeamId: 'someTeamId',
                    myMembers: {
                        someTeamId: {
                            roles,
                        },
                    },
                },
            },
        };

        const store = mockStore(state);

        getState.mockImplementation(store.getState);

        const searchText = 'not matching text';
        searchProvider.handlePretextChanged(searchText, resultsCallback);
        expect(resultsCallback).toHaveBeenCalled();
        const args = resultsCallback.mock.calls[0][0];

        expect(args.items.length).toEqual(0);
    });
});
