// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';

import UserDetails from './user_details';

describe('components/more_direct_channels/list_item/user_details/UserDetails', () => {
    const baseProps = {
        currentUserId: 'current_user_id',
        status: 'online',
        actions: {
            fetchRemoteClusterInfo: jest.fn(),
        },
    };

    const mockUser: UserProfile = {
        id: 'user_id',
        create_at: 1234567890,
        update_at: 1234567890,
        delete_at: 0,
        username: 'testuser',
        password: '',
        auth_data: '',
        auth_service: '',
        email: 'test@example.com',
        nickname: 'Test User',
        first_name: 'Test',
        last_name: 'User',
        position: '',
        roles: 'system_user',
        props: {},
        notify_props: {
            email: 'true',
            push: 'mention',
            desktop: 'mention',
            desktop_sound: 'true',
            calls_desktop_sound: 'true',
            mark_unread: 'all',
            push_status: 'online',
            comments: 'never',
            mention_keys: '',
            highlight_keys: '',
            channel: 'true',
            first_name: 'false',
            auto_responder_active: 'false',
            auto_responder_message: '',
        },
        last_password_update: 1234567890,
        last_picture_update: 1234567890,
        last_activity_at: 1234567890,
        failed_attempts: 0,
        locale: 'en',
        timezone: {
            useAutomaticTimezone: 'true',
            automaticTimezone: '',
            manualTimezone: '',
        },
        mfa_active: false,
        is_bot: false,
        bot_description: '',
        terms_of_service_id: '',
        terms_of_service_create_at: 0,
    };

    const initialState = {
        entities: {
            sharedChannels: {
                remotesByRemoteId: {
                    remote_id_123: {
                        remote_id: 'remote_id_123',
                        display_name: 'Remote Organization',
                        site_url: 'https://remote.example.com',
                    },
                },
            },
        },
    };

    test('should render local user without shared indicator', () => {
        const localUser = {
            ...mockUser,
            remote_id: '',
        };

        renderWithContext(
            <UserDetails
                {...baseProps}
                option={localUser}
            />,
            initialState,
        );

        expect(screen.getByText('@testuser')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        expect(screen.queryByTestId('SharedUserIcon')).not.toBeInTheDocument();
    });

    test('should render remote user with shared indicator', () => {
        const remoteUser = {
            ...mockUser,
            remote_id: 'remote_id_123',
        };

        renderWithContext(
            <UserDetails
                {...baseProps}
                option={remoteUser}
            />,
            initialState,
        );

        expect(screen.getByText('@testuser')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        expect(screen.getByTestId('SharedUserIcon')).toBeInTheDocument();
    });

    test('should show remote organization name in tooltip for remote user', async () => {
        jest.useFakeTimers();

        const remoteUser = {
            ...mockUser,
            remote_id: 'remote_id_123',
        };

        renderWithContext(
            <UserDetails
                {...baseProps}
                option={remoteUser}
            />,
            initialState,
        );

        const icon = screen.getByTestId('SharedUserIcon');
        expect(icon).toBeInTheDocument();

        await userEvent.hover(icon, {advanceTimers: jest.advanceTimersByTime});

        await waitFor(() => {
            expect(screen.getByText('From: Remote Organization')).toBeInTheDocument();
        });
    });

    test('should show generic tooltip for remote user when remote display name not available', async () => {
        jest.useFakeTimers();

        const remoteUser = {
            ...mockUser,
            remote_id: 'unknown_remote_id',
        };

        renderWithContext(
            <UserDetails
                {...baseProps}
                option={remoteUser}
            />,
            initialState,
        );

        const icon = screen.getByTestId('SharedUserIcon');
        expect(icon).toBeInTheDocument();

        await userEvent.hover(icon, {advanceTimers: jest.advanceTimersByTime});

        await waitFor(() => {
            expect(screen.getByText('From trusted organizations')).toBeInTheDocument();
        });
    });

    test('should render current user with "(you)" suffix', () => {
        const currentUser = {
            ...mockUser,
            id: 'current_user_id',
        };

        renderWithContext(
            <UserDetails
                {...baseProps}
                option={currentUser}
            />,
            initialState,
        );

        expect(screen.getByText('(you)')).toBeInTheDocument();
    });

    test('should render deactivated user with "- Deactivated" suffix', () => {
        const deactivatedUser = {
            ...mockUser,
            delete_at: 1234567890,
        };

        renderWithContext(
            <UserDetails
                {...baseProps}
                option={deactivatedUser}
            />,
            initialState,
        );

        expect(screen.getByText('- Deactivated')).toBeInTheDocument();
    });

    test('should render bot user with bot tag and no email', () => {
        const botUser = {
            ...mockUser,
            is_bot: true,
        };

        renderWithContext(
            <UserDetails
                {...baseProps}
                option={botUser}
            />,
            initialState,
        );

        expect(screen.getByText('@testuser')).toBeInTheDocument();
        expect(screen.getByText('BOT')).toBeInTheDocument();
        expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();
    });

    test('should render guest user with guest tag', () => {
        const guestUser = {
            ...mockUser,
            roles: 'system_guest',
        };

        renderWithContext(
            <UserDetails
                {...baseProps}
                option={guestUser}
            />,
            initialState,
        );

        expect(screen.getByText('@testuser')).toBeInTheDocument();
        expect(screen.getByText('GUEST')).toBeInTheDocument();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.clearAllMocks();
    });
});
