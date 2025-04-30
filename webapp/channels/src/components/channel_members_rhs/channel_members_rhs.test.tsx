// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

import ChannelMembersRHS from './index';

// Mock the Redux connected component
jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    connect: () => (Component: React.ComponentType) => Component,
}));

jest.mock('./member_list', () => {
    const ListItemType = {
        Member: 'member',
        FirstSeparator: 'first-separator',
        Separator: 'separator',
    };

    // Mock component with exported types
    const mockComponent = jest.fn(() => <div data-testid='member-list'>{'Member List Mock'}</div>);
    return Object.assign(mockComponent, {
        ListItemType,

        // These are just type exports, not used at runtime
        __esModule: true,
    });
});

jest.mock('./header', () => {
    return jest.fn(() => <div data-testid='header'>{'Header Mock'}</div>);
});

jest.mock('./action_bar', () => {
    return jest.fn(() => <div data-testid='action-bar'>{'Action Bar Mock'}</div>);
});

jest.mock('./search', () => {
    return jest.fn(() => <div data-testid='search-bar'>{'Search Bar Mock'}</div>);
});

describe('channel_members_rhs/channel_members_rhs', () => {
    // Using 'as any' to bypass TypeScript errors in test data
    const baseProps = {
        channel: {
            id: 'channel_id',
            name: 'channel-name',
            display_name: 'Channel Name',
            type: Constants.OPEN_CHANNEL,
            team_id: 'team_id',
            header: '',
            purpose: '',
            creator_id: '',
            scheme_id: '',
            group_constrained: false,
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            last_post_at: 0,
            last_root_post_at: 0,
            total_msg_count: 0,
            total_msg_count_root: 0,
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
                    create_at: 0,
                    update_at: 0,
                    delete_at: 0,
                    auth_service: '',
                    email_verified: true,
                    is_bot: false,
                    nickname: '',
                    first_name: 'User',
                    last_name: 'One',
                    position: '',
                    roles: '',
                    locale: '',
                    notify_props: {
                        desktop: 'default',
                        desktop_sound: 'true',
                        email: 'true',
                        mark_unread: 'all',
                        push: 'default',
                        push_status: 'ooo',
                        comments: 'never',
                        first_name: 'false',
                        channel: 'true',
                        mention_keys: '',
                    },
                    props: {},
                    terms_of_service_id: '',
                    terms_of_service_create_at: 0,
                    last_picture_update: 0,
                },
                membership: {
                    user_id: 'user1',
                    channel_id: 'channel_id',
                    scheme_admin: true,
                    scheme_user: true,
                    roles: '',
                    last_viewed_at: 0,
                    msg_count: 0,
                    mention_count: 0,
                    mention_count_root: 0,
                    msg_count_root: 0,
                    notify_props: {
                        desktop: 'default',
                        mark_unread: 'all',
                    },
                    last_update_at: 0,
                },
                displayName: 'User One',
            },
            {
                user: {
                    id: 'user2',
                    username: 'user2',
                    email: 'user2@example.com',
                    create_at: 0,
                    update_at: 0,
                    delete_at: 0,
                    auth_service: '',
                    email_verified: true,
                    is_bot: false,
                    nickname: '',
                    first_name: 'User',
                    last_name: 'Two',
                    position: '',
                    roles: '',
                    locale: '',
                    notify_props: {
                        desktop: 'default',
                        desktop_sound: 'true',
                        email: 'true',
                        mark_unread: 'all',
                        push: 'default',
                        push_status: 'ooo',
                        comments: 'never',
                        first_name: 'false',
                        channel: 'true',
                        mention_keys: '',
                    },
                    props: {},
                    terms_of_service_id: '',
                    terms_of_service_create_at: 0,
                    last_picture_update: 0,
                },
                membership: {
                    user_id: 'user2',
                    channel_id: 'channel_id',
                    scheme_admin: false,
                    scheme_user: true,
                    roles: '',
                    last_viewed_at: 0,
                    msg_count: 0,
                    mention_count: 0,
                    mention_count_root: 0,
                    msg_count_root: 0,
                    notify_props: {
                        desktop: 'default',
                        mark_unread: 'all',
                    },
                    last_update_at: 0,
                },
                displayName: 'User Two',
            },
        ],
        canManageMembers: true,
        editing: false,
        actions: {
            openModal: jest.fn(),
            openDirectChannelToUserId: jest.fn().mockResolvedValue({data: {}}),
            closeRightHandSide: jest.fn(),
            goBack: jest.fn(),
            setChannelMembersRhsSearchTerm: jest.fn(),
            loadProfilesAndReloadChannelMembers: jest.fn(),
            loadMyChannelMemberAndRole: jest.fn(),
            setEditChannelMembers: jest.fn(),
            searchProfilesAndChannelMembers: jest.fn().mockResolvedValue({data: []}),
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

        expect(screen.getByText('In this channel, you can only remove guests. Only')).toBeInTheDocument();
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
    });
});
