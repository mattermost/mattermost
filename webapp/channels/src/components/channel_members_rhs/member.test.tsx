// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen, waitFor, act} from 'tests/react_testing_utils';

import Member from './member';
import type {ChannelMember} from './member_list';

describe('components/channel_members_rhs/Member', () => {
    const baseProps = {
        channel: {
            id: 'channel_id',
            display_name: 'Test Channel',
            name: 'test-channel',
            type: 'O',
            create_at: 1234567890,
            update_at: 1234567890,
            delete_at: 0,
            creator_id: 'creator_id',
            header: '',
            purpose: '',
            last_post_at: 1234567890,
            team_id: 'team_id',
            total_msg_count: 0,
            extra_update_at: 0,
            scheme_id: '',
        },
        index: 0,
        totalUsers: 5,
        editing: false,
        actions: {
            openDirectMessage: jest.fn(),
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
        email_verified: true,
        nickname: 'Test User',
        first_name: 'Test',
        last_name: 'User',
        position: '',
        roles: 'system_user',
        allow_marketing: false,
        props: {},
        notify_props: {
            email: 'true',
            push: 'mention',
            desktop: 'mention',
            desktop_sound: 'true',
            mention_keys: '',
            channel: 'true',
            first_name: 'false',
            auto_responder_active: 'false',
            auto_responder_message: '',
        },
        last_password_update: 1234567890,
        last_picture_update: 1234567890,
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
        bot_last_icon_update: 0,
        terms_of_service_id: '',
        terms_of_service_create_at: 0,
    };

    const baseMember: ChannelMember = {
        user: mockUser,
        membership: {
            channel_id: 'channel_id',
            user_id: 'user_id',
            roles: 'channel_user',
            last_viewed_at: 1234567890,
            msg_count: 0,
            mention_count: 0,
            mention_count_root: 0,
            urgent_mention_count: 0,
            notify_props: {
                desktop: 'default',
                email: 'default',
                mark_unread: 'all',
                push: 'default',
                ignore_channel_mentions: 'default',
            },
            last_update_at: 1234567890,
            scheme_user: true,
            scheme_admin: false,
            explicit_roles: '',
            scheme_guest: false,
        },
        status: 'online',
        displayName: 'Test User',
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
        const localMember = {
            ...baseMember,
            user: {
                ...mockUser,
                remote_id: '',
            },
        };

        renderWithContext(
            <Member
                {...baseProps}
                member={localMember}
            />,
            initialState,
        );

        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.queryByTestId('SharedChannelIcon')).not.toBeInTheDocument();
    });

    test('should render remote user with shared indicator', () => {
        const remoteMember = {
            ...baseMember,
            user: {
                ...mockUser,
                remote_id: 'remote_id_123',
            },
        };

        renderWithContext(
            <Member
                {...baseProps}
                member={remoteMember}
            />,
            initialState,
        );

        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByTestId('SharedChannelIcon')).toBeInTheDocument();
    });

    test('should show remote organization name in tooltip for remote user', async () => {
        jest.useFakeTimers();

        const remoteMember = {
            ...baseMember,
            user: {
                ...mockUser,
                remote_id: 'remote_id_123',
            },
        };

        renderWithContext(
            <Member
                {...baseProps}
                member={remoteMember}
            />,
            initialState,
        );

        const icon = screen.getByTestId('SharedChannelIcon');
        expect(icon).toBeInTheDocument();

        await act(async () => {
            userEvent.hover(icon);
            jest.advanceTimersByTime(1000);

            await waitFor(() => {
                expect(screen.getByText('Shared with: Remote Organization')).toBeInTheDocument();
            });
        });
    });

    test('should show generic tooltip for remote user when remote display name not available', async () => {
        jest.useFakeTimers();

        const remoteMember = {
            ...baseMember,
            user: {
                ...mockUser,
                remote_id: 'unknown_remote_id',
            },
        };

        renderWithContext(
            <Member
                {...baseProps}
                member={remoteMember}
            />,
            initialState,
        );

        const icon = screen.getByTestId('SharedChannelIcon');
        expect(icon).toBeInTheDocument();

        await act(async () => {
            userEvent.hover(icon);
            jest.advanceTimersByTime(1000);

            await waitFor(() => {
                expect(screen.getByText('Shared with trusted organizations')).toBeInTheDocument();
            });
        });
    });

    test('should render guest tag for guest user', () => {
        const guestMember = {
            ...baseMember,
            user: {
                ...mockUser,
                roles: 'system_guest',
            },
        };

        renderWithContext(
            <Member
                {...baseProps}
                member={guestMember}
            />,
            initialState,
        );

        expect(screen.getByText('Guest')).toBeInTheDocument();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.clearAllMocks();
    });
});
