// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {Permissions, Preferences} from 'mattermost-redux/constants';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {fireEvent, renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import Constants, {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import Sidebar from './sidebar';

describe('components/sidebar', () => {
    const currentTeam = TestHelper.getTeamMock({
        id: 'current_team_id',
        display_name: 'Current Test Team',
    });

    const initialState: DeepPartial<GlobalState> = {
        entities: {
            teams: {
                currentTeamId: currentTeam.id,
                teams: {
                    [currentTeam.id]: currentTeam,
                },
                myMembers: {
                    [currentTeam.id]: {
                        roles: 'team_user',
                    },
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {
                        id: 'current_user_id',
                        roles: 'system_user system_admin',
                    },
                },
            },
            roles: {
                roles: {
                    system_admin: {
                        permissions: [Permissions.MANAGE_TEAM],
                    },
                    system_user: {
                        permissions: [],
                    },
                    team_user: {
                        permissions: [],
                    },
                },
            },
            preferences: {
                myPreferences: {},
            },
            general: {
                config: {},
            },
        },
    };

    const baseProps = {
        canCreatePublicChannel: true,
        canCreatePrivateChannel: true,
        canJoinPublicChannel: true,
        isOpen: false,
        teamId: currentTeam.id,
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

    test('should render the sidebar components correctly', () => {
        renderWithContext(
            <Sidebar {...baseProps}/>,
            initialState,
        );

        // Check for SidebarContainer that is the parent of the sidebar
        expect(document.getElementById('SidebarContainer')).toBeInTheDocument();

        expect(screen.getByRole('application', {name: /channel sidebar region/i})).toBeInTheDocument();
    });

    test('should not rendering anything when teamId is missing', () => {
        const props = {
            ...baseProps,
            teamId: '',
        };
        renderWithContext(
            <Sidebar {...props}/>,
            initialState,
        );

        expect(screen.queryByRole('application', {name: /channel sidebar region/i})).toBeNull();
    });

    describe('unreads category', () => {
        const currentUserId = 'current_user_id';

        const channel1 = TestHelper.getChannelMock({id: 'channel1', team_id: currentTeam.id});
        const channel2 = TestHelper.getChannelMock({id: 'channel2', team_id: currentTeam.id});

        const baseState: DeepPartial<GlobalState> = {
            entities: {
                channels: {
                    currentChannelId: channel1.id,
                    channels: {
                        channel1,
                        channel2,
                    },
                    channelsInTeam: {
                        [currentTeam.id]: new Set([channel1.id, channel2.id]),
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
                    currentTeamId: currentTeam.id,
                    teams: {
                        [currentTeam.id]: currentTeam,
                    },
                    myMembers: {
                        [currentTeam.id]: {
                            roles: 'team_user',
                        },
                    },
                },
                users: {
                    currentUserId,
                    profiles: {
                        [currentUserId]: {
                            id: currentUserId,
                            roles: 'system_user system_admin',
                        },
                    },
                },
                roles: {
                    roles: {
                        system_admin: {
                            permissions: [Permissions.MANAGE_TEAM],
                        },
                        system_user: {
                            permissions: [],
                        },
                        team_user: {
                            permissions: [],
                        },
                    },
                },
                general: {
                    config: {},
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

    describe('modals', () => {
        test('should call Shortcut modal on FORWARD_SLASH+ctrl/meta', () => {
            const openModalSpy = jest.fn();
            const closeModalSpy = jest.fn();

            const props = {
                ...baseProps,
                isKeyBoardShortcutModalOpen: false,
                actions: {
                    ...baseProps.actions,
                    openModal: openModalSpy,
                    closeModal: closeModalSpy,
                },
            };

            renderWithContext(
                <Sidebar {...props}/>,
                initialState,
            );
            expect(document.getElementById('SidebarContainer')).toBeInTheDocument();

            // Test with backslash key (should not trigger the modal)
            fireEvent.keyDown(document, {
                key: '\\',
                code: 'Backslash',
                keyCode: Constants.KeyCodes.BACK_SLASH[1],
                ctrlKey: true,
            });
            expect(openModalSpy).not.toHaveBeenCalled();

            // Test with 'ù' key but with forward slash keyCode (should trigger the modal)
            fireEvent.keyDown(document, {
                key: 'ù',
                code: 'Slash',
                keyCode: Constants.KeyCodes.FORWARD_SLASH[1],
                ctrlKey: true,
            });
            expect(openModalSpy).toHaveBeenCalledWith(expect.objectContaining({
                modalId: ModalIdentifiers.KEYBOARD_SHORTCUTS_MODAL,
            }));

            // Reset the spy
            openModalSpy.mockClear();

            // Test with '/' key but with seven keyCode (should trigger the modal)
            fireEvent.keyDown(document, {
                key: '/',
                code: 'Digit7',
                keyCode: Constants.KeyCodes.SEVEN[1],
                ctrlKey: true,
            });
            expect(openModalSpy).toHaveBeenCalledWith(expect.objectContaining({
                modalId: ModalIdentifiers.KEYBOARD_SHORTCUTS_MODAL,
            }));

            // Reset the spy
            openModalSpy.mockClear();

            // Test with forward slash key (should trigger the modal)
            fireEvent.keyDown(document, {
                key: '/',
                code: 'Slash',
                keyCode: Constants.KeyCodes.FORWARD_SLASH[1],
                ctrlKey: true,
            });
            expect(openModalSpy).toHaveBeenCalledWith(expect.objectContaining({
                modalId: ModalIdentifiers.KEYBOARD_SHORTCUTS_MODAL,
            }));
        });

        test('should close Shortcut modal on FORWARD_SLASH+ctrl/meta when already open', () => {
            const openModalSpy = jest.fn();
            const closeModalSpy = jest.fn();

            const props = {
                ...baseProps,
                isKeyBoardShortcutModalOpen: true, // Modal is already open
                actions: {
                    ...baseProps.actions,
                    openModal: openModalSpy,
                    closeModal: closeModalSpy,
                },
            };

            renderWithContext(
                <Sidebar {...props}/>,
                initialState,
            );

            expect(document.getElementById('SidebarContainer')).toBeInTheDocument();

            // Test with forward slash key (should close the modal since it's already open)
            fireEvent.keyDown(document, {
                key: '/',
                code: 'Slash',
                keyCode: Constants.KeyCodes.FORWARD_SLASH[1],
                ctrlKey: true,
            });

            // Should call closeModal with the keyboard shortcuts modal ID
            expect(closeModalSpy).toHaveBeenCalledWith(ModalIdentifiers.KEYBOARD_SHORTCUTS_MODAL);

            // Should not call openModal
            expect(openModalSpy).not.toHaveBeenCalled();
        });
    });
});
