// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import Constants from 'utils/constants';

import ChannelMembersRHS from './channel_members_rhs';

// Mock the Redux connected component
vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return {
        ...actual,
        connect: () => (Component: React.ComponentType) => Component,
    };
});

vi.mock('./member_list', () => {
    const ListItemType = {
        Member: 'member',
        FirstSeparator: 'first-separator',
        Separator: 'separator',
    };

    const mockComponent = vi.fn(() => <div data-testid='member-list'>{'Member List Mock'}</div>);
    return {
        __esModule: true,
        default: mockComponent,
        ListItemType,
    };
});

vi.mock('./header', () => {
    return {
        __esModule: true,
        default: vi.fn(() => <div data-testid='header'>{'Header Mock'}</div>),
    };
});

vi.mock('./action_bar', () => {
    return {
        __esModule: true,
        default: vi.fn(() => <div data-testid='action-bar'>{'Action Bar Mock'}</div>),
    };
});

vi.mock('./search', () => {
    return {
        __esModule: true,
        default: vi.fn(() => <div data-testid='search-bar'>{'Search Bar Mock'}</div>),
    };
});

// Mock the useAccessControlAttributes hook
vi.mock('components/common/hooks/useAccessControlAttributes', () => {
    // Define the EntityType enum in the mock
    const EntityType = {
        Channel: 'channel',
    };

    const mockHook = vi.fn(() => ({
        attributeTags: ['tag1', 'tag2'],
        structuredAttributes: [
            {
                name: 'attribute1',
                values: ['tag1', 'tag2'],
            },
        ],
        loading: false,
        error: null,
        fetchAttributes: vi.fn(),
    }));

    // Export both the default export (the hook) and the named export (EntityType)
    return {
        __esModule: true,
        default: mockHook,
        EntityType,
    };
});

describe('channel_members_rhs/channel_members_rhs', () => {
    // Using 'as any' to bypass TypeScript errors in test data
    const baseProps = {
        channel: {
            id: 'channel_id',
            name: 'channel-name',
            display_name: 'Channel Name',
            type: 'O' as ChannelType,
            team_id: 'team_id',
            group_constrained: false,
        },
        currentUserIsChannelAdmin: true,
        membersCount: 3,
        searchTerms: '',
        canGoBack: false,
        teamUrl: '/team',
        channelMembers: [
            {
                user: {
                    id: 'user1',
                    username: 'user1',
                    email: 'user1@example.com',
                    first_name: 'User',
                    last_name: 'One',
                },
                membership: {
                    user_id: 'user1',
                    channel_id: 'channel_id',
                    scheme_admin: true,
                    scheme_user: true,
                },
                displayName: 'User One',
            },
            {
                user: {
                    id: 'user2',
                    username: 'user2',
                    email: 'user2@example.com',
                    first_name: 'User',
                    last_name: 'Two',
                },
                membership: {
                    user_id: 'user2',
                    channel_id: 'channel_id',
                    scheme_admin: false,
                    scheme_user: true,
                },
                displayName: 'User Two',
            },
        ],
        canManageMembers: true,
        editing: false,
        actions: {
            openModal: vi.fn(),
            openDirectChannelToUserId: vi.fn().mockResolvedValue({data: {}}),
            closeRightHandSide: vi.fn(),
            goBack: vi.fn(),
            setChannelMembersRhsSearchTerm: vi.fn(),
            loadProfilesAndReloadChannelMembers: vi.fn(),
            loadMyChannelMemberAndRole: vi.fn(),
            setEditChannelMembers: vi.fn(),
            searchProfilesAndChannelMembers: vi.fn().mockResolvedValue({data: []}),
            fetchRemoteClusterInfo: vi.fn(),
        },
    };

    test('should render correctly', () => {
        renderWithContext(
            <ChannelMembersRHS
                {...baseProps as any}
            />,
        );

        // Check that the main components are rendered
        expect(screen.getByTestId('header')).toBeInTheDocument();
        expect(screen.getByTestId('action-bar')).toBeInTheDocument();
        expect(screen.getByTestId('member-list')).toBeInTheDocument();
    });

    test('should show search bar when there are more than 20 members', () => {
        const props = {
            ...baseProps,
            membersCount: 25,
        };

        renderWithContext(
            <ChannelMembersRHS
                {...props as any}
            />,
        );

        expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    });

    test('should show search bar when search terms are present', () => {
        const props = {
            ...baseProps,
            searchTerms: 'test',
        };

        renderWithContext(
            <ChannelMembersRHS
                {...props as any}
            />,
        );

        expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    });

    test('should not show search bar when there are less than 20 members and no search terms', () => {
        renderWithContext(
            <ChannelMembersRHS
                {...baseProps as any}
            />,
        );

        expect(screen.queryByTestId('search-bar')).not.toBeInTheDocument();
    });

    test('should show alert banner for default channel when editing and not channel admin', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                name: Constants.DEFAULT_CHANNEL,
            },
            currentUserIsChannelAdmin: false,
            editing: true,
        };

        renderWithContext(
            <ChannelMembersRHS
                {...props as any}
            />,
        );

        expect(screen.getByText(/In this channel, you can only remove guests/)).toBeInTheDocument();
        expect(screen.getByText(/channel admins/)).toBeInTheDocument();
    });

    test('should show alert banner for policy-enforced channels', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                policy_enforced: true,
            },
        };

        renderWithContext(
            <ChannelMembersRHS
                {...props as any}
            />,
        );

        expect(screen.getByText('Channel access is restricted by user attributes')).toBeInTheDocument();
        expect(screen.getByText('tag1')).toBeInTheDocument();
        expect(screen.getByText('tag2')).toBeInTheDocument();
    });
});
