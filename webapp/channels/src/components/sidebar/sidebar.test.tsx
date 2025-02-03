// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {Preferences} from 'mattermost-redux/constants';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import Constants, {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import Sidebar from './sidebar';

describe('components/sidebar', () => {
    const currentTeamId = 'fake_team_id';

    const baseProps = {
        canCreatePublicChannel: true,
        canCreatePrivateChannel: true,
        canJoinPublicChannel: true,
        isOpen: false,
        teamId: currentTeamId,
        hasSeenModal: true,
        isCloud: false,
        unreadFilterEnabled: false,
        isMobileView: false,
        isKeyBoardShortcutModalOpen: false,
        userGroupsEnabled: false,
        canCreateCustomGroups: true,
        actions: {
            createCategory: jest.fn(),
            fetchMyCategories: jest.fn(),
            openModal: jest.fn(),
            closeModal: jest.fn(),
            clearChannelSelection: jest.fn(),
            closeRightHandSide: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <Sidebar {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when direct channels modal is open', () => {
        const wrapper = shallow(
            <Sidebar {...baseProps}/>,
        );

        wrapper.instance().setState({showDirectChannelsModal: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when more channels modal is open', () => {
        const wrapper = shallow(
            <Sidebar {...baseProps}/>,
        );

        wrapper.instance().setState({showMoreChannelsModal: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('Should call Shortcut modal on FORWARD_SLASH+ctrl/meta', () => {
        const wrapper = shallow<Sidebar>(
            <Sidebar {...baseProps}/>,
        );
        const instance = wrapper.instance();

        let key = Constants.KeyCodes.BACK_SLASH[0] as string;
        let keyCode = Constants.KeyCodes.BACK_SLASH[1] as number;
        instance.handleKeyDownEvent({ctrlKey: true, preventDefault: jest.fn(), key, keyCode} as any);
        expect(wrapper.instance().props.actions.openModal).not.toHaveBeenCalled();

        key = 'ù';
        keyCode = Constants.KeyCodes.FORWARD_SLASH[1] as number;
        instance.handleKeyDownEvent({ctrlKey: true, preventDefault: jest.fn(), key, keyCode} as any);
        expect(wrapper.instance().props.actions.openModal).toHaveBeenCalledWith(expect.objectContaining({modalId: ModalIdentifiers.KEYBOARD_SHORTCUTS_MODAL}));

        key = '/';
        keyCode = Constants.KeyCodes.SEVEN[1] as number;
        instance.handleKeyDownEvent({ctrlKey: true, preventDefault: jest.fn(), key, keyCode} as any);
        expect(wrapper.instance().props.actions.openModal).toHaveBeenCalledWith(expect.objectContaining({modalId: ModalIdentifiers.KEYBOARD_SHORTCUTS_MODAL}));

        key = Constants.KeyCodes.FORWARD_SLASH[0] as string;
        keyCode = Constants.KeyCodes.FORWARD_SLASH[1] as number;
        instance.handleKeyDownEvent({ctrlKey: true, preventDefault: jest.fn(), key, keyCode} as any);
        expect(wrapper.instance().props.actions.openModal).toHaveBeenCalledWith(expect.objectContaining({modalId: ModalIdentifiers.KEYBOARD_SHORTCUTS_MODAL}));
    });

    test('should toggle direct messages modal correctly', () => {
        const wrapper = shallow<Sidebar>(
            <Sidebar {...baseProps}/>,
        );
        const instance = wrapper.instance();
        const mockEvent: Partial<Event> = {preventDefault: jest.fn()};

        instance.hideMoreDirectChannelsModal = jest.fn();
        instance.showMoreDirectChannelsModal = jest.fn();

        instance.handleOpenMoreDirectChannelsModal(mockEvent as any);
        expect(instance.showMoreDirectChannelsModal).toHaveBeenCalled();

        instance.setState({showDirectChannelsModal: true});
        instance.handleOpenMoreDirectChannelsModal(mockEvent as any);
        expect(instance.hideMoreDirectChannelsModal).toHaveBeenCalled();
    });

    test('should match empty div snapshot when teamId is missing', () => {
        const props = {
            ...baseProps,
            teamId: '',
        };
        const wrapper = shallow(
            <Sidebar {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    describe('unreads category', () => {
        const currentUserId = 'current_user_id';

        const channel1 = TestHelper.getChannelMock({id: 'channel1', team_id: currentTeamId});
        const channel2 = TestHelper.getChannelMock({id: 'channel2', team_id: currentTeamId});

        const baseState: DeepPartial<GlobalState> = {
            entities: {
                channels: {
                    currentChannelId: channel1.id,
                    channels: {
                        channel1,
                        channel2,
                    },
                    channelsInTeam: {
                        [currentTeamId]: new Set([channel1.id, channel2.id]),
                    },
                    messageCounts: {
                        channel1: {total: 10},
                        channel2: {total: 10},
                    },
                    myMembers: {
                        channel1: TestHelper.getChannelMembershipMock({channel_id: channel1.id, user_id: currentUserId, msg_count: 10}),
                        channel2: TestHelper.getChannelMembershipMock({channel_id: channel2.id, user_id: currentUserId, msg_count: 10}),
                    },
                },
                teams: {
                    currentTeamId,
                    teams: {
                        [currentTeamId]: TestHelper.getTeamMock({id: currentTeamId}),
                    },
                },
                users: {
                    currentUserId,
                },
            },
        };

        test('should not render unreads category when disabled by user preference', async () => {
            const testState = {
                entities: {
                    channels: {
                        messageCounts: {
                            [channel2.id]: {total: 15},
                        },
                    },
                    preferences: {
                        myPreferences: TestHelper.getPreferencesMock([
                            {category: Preferences.CATEGORY_SIDEBAR_SETTINGS, name: Preferences.SHOW_UNREAD_SECTION, value: 'false'},
                        ]),
                    },
                },
            };

            renderWithContext(
                <Sidebar {...baseProps}/>,
                mergeObjects(baseState, testState),
            );

            await waitFor(() => {
                expect(screen.queryByText('UNREADS')).not.toBeInTheDocument();
            });
        });

        test('should render unreads category when there are unread channels', async () => {
            const testState: DeepPartial<GlobalState> = {
                entities: {
                    channels: {
                        messageCounts: {
                            [channel2.id]: {total: 15},
                        },
                    },
                    preferences: {
                        myPreferences: TestHelper.getPreferencesMock([
                            {category: Preferences.CATEGORY_SIDEBAR_SETTINGS, name: Preferences.SHOW_UNREAD_SECTION, value: 'true'},
                        ]),
                    },
                },
            };

            renderWithContext(
                <Sidebar {...baseProps}/>,
                mergeObjects(baseState, testState),
            );

            await waitFor(() => {
                expect(screen.queryByText('UNREADS')).toBeInTheDocument();
            });
        });

        test('should not render unreads category when there are no unread channels', async () => {
            const testState: DeepPartial<GlobalState> = {
                entities: {
                    preferences: {
                        myPreferences: TestHelper.getPreferencesMock([
                            {category: Preferences.CATEGORY_SIDEBAR_SETTINGS, name: Preferences.SHOW_UNREAD_SECTION, value: 'true'},
                        ]),
                    },
                },
            };

            renderWithContext(
                <Sidebar {...baseProps}/>,
                mergeObjects(baseState, testState),
            );

            await waitFor(() => {
                expect(screen.queryByText('UNREADS')).not.toBeInTheDocument();
            });
        });

        test('should render unreads category when there are no unread channels but the current channel was previously unread', async () => {
            const testState: DeepPartial<GlobalState> = {
                entities: {
                    preferences: {
                        myPreferences: TestHelper.getPreferencesMock([
                            {category: Preferences.CATEGORY_SIDEBAR_SETTINGS, name: Preferences.SHOW_UNREAD_SECTION, value: 'true'},
                        ]),
                    },
                },
                views: {
                    channel: {
                        lastUnreadChannel: {id: channel1.id} as any,
                    },
                },
            };

            renderWithContext(
                <Sidebar {...baseProps}/>,
                mergeObjects(baseState, testState),
            );

            await waitFor(() => {
                expect(screen.queryByText('UNREADS')).toBeInTheDocument();
            });
        });
    });
});
