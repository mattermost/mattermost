// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {PostPriority} from '@mattermost/types/posts';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import PostPriorityPicker from './post_priority_picker';

const makeInitialState = (configOverrides: Record<string, string> = {}) => ({
    entities: {
        general: {
            config: {
                PostPriority: 'true',
                PostAcknowledgements: 'true',
                AllowPersistentNotifications: 'true',
                AllowPersistentNotificationsForGuests: 'false',
                PersistentNotificationIntervalMinutes: '5',
                ...configOverrides,
            },
        },
        users: {
            currentUserId: 'user1',
            profiles: {
                user1: TestHelper.getUserMock({id: 'user1', roles: 'system_user'}),
            },
        },
        preferences: {
            myPreferences: {},
        },
    },
});

function renderPicker(props: Partial<React.ComponentProps<typeof PostPriorityPicker>> = {}, configOverrides: Record<string, string> = {}) {
    const defaultProps = {
        settings: undefined,
        onClose: jest.fn(),
        onApply: jest.fn(),
        disabled: false,
    };
    return renderWithContext(
        <PostPriorityPicker {...defaultProps} {...props}/>,
        makeInitialState(configOverrides),
    );
}

async function openPicker() {
    const trigger = screen.getByLabelText('Message priority');
    await userEvent.click(trigger);
    await waitFor(() => screen.getByText('Urgent'));
}

async function selectUrgentAndEnablePersistentNotifications() {
    await openPicker();
    await userEvent.click(screen.getByText('Urgent'));
    await waitFor(() => screen.getByText('Send persistent notifications'));
    const toggle = screen.getByRole('menuitemcheckbox', {name: /send persistent notifications/i});
    if (toggle.getAttribute('aria-checked') !== 'true') {
        await userEvent.click(toggle);
    }
    await waitFor(() => screen.getByText('Every 1 min'));
}

describe('PostPriorityPicker — persistent notification interval', () => {
    test('interval options appear when persistent notifications is toggled on', async () => {
        renderPicker();
        await selectUrgentAndEnablePersistentNotifications();

        expect(screen.getByText('Every 1 min')).toBeInTheDocument();
        expect(screen.getByText('Every 2 mins')).toBeInTheDocument();
        expect(screen.getByText('Every 5 mins')).toBeInTheDocument();
        expect(screen.getByText('Every 10 mins')).toBeInTheDocument();
        expect(screen.getByText('Every 15 mins')).toBeInTheDocument();
    });

    test('interval options do NOT appear when persistent notifications is off', async () => {
        renderPicker({
            settings: {
                priority: PostPriority.URGENT,
                persistent_notifications: false,
            },
        });
        await openPicker();

        expect(screen.queryByText('Every 1 min')).not.toBeInTheDocument();
        expect(screen.queryByText('Every 5 mins')).not.toBeInTheDocument();
    });

    test('admin default interval is pre-selected when no saved interval', async () => {
        renderPicker();
        await selectUrgentAndEnablePersistentNotifications();

        expect(screen.getByRole('menuitemradio', {name: /every 5 mins/i})).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('menuitemradio', {name: /every 2 mins/i})).toHaveAttribute('aria-checked', 'false');
    });

    test('saved interval is pre-selected when reopening picker', async () => {
        renderPicker({
            settings: {
                priority: PostPriority.URGENT,
                persistent_notifications: true,
                persistent_notification_interval: 2,
            },
        });
        await openPicker();
        await waitFor(() => screen.getByText('Every 2 mins'));

        expect(screen.getByRole('menuitemradio', {name: /every 2 mins/i})).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('menuitemradio', {name: /every 5 mins/i})).toHaveAttribute('aria-checked', 'false');
    });

    test('selecting an interval includes it in onApply output', async () => {
        const onApply = jest.fn();
        renderPicker({onApply});
        await selectUrgentAndEnablePersistentNotifications();

        await userEvent.click(screen.getByRole('menuitemradio', {name: /every 2 mins/i}));
        await userEvent.click(screen.getByText('Apply'));

        expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
            persistent_notifications: true,
            persistent_notification_interval: 2,
        }));
    });

    test('interval is undefined in onApply when persistent notifications is off', async () => {
        const onApply = jest.fn();
        renderPicker({
            settings: {
                priority: PostPriority.URGENT,
                persistent_notifications: false,
            },
            onApply,
        });
        await openPicker();
        await userEvent.click(screen.getByText('Apply'));

        expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
            persistent_notifications: false,
            persistent_notification_interval: undefined,
        }));
    });

    test('toggling persistent notifications off then on resets interval to admin default', async () => {
        const onApply = jest.fn();
        renderPicker({
            settings: {
                priority: PostPriority.URGENT,
                persistent_notifications: true,
                persistent_notification_interval: 2,
            },
            onApply,
        });
        await openPicker();
        await waitFor(() => screen.getByText('Send persistent notifications'));

        // Toggle off then back on
        await userEvent.click(screen.getByText('Send persistent notifications'));
        await userEvent.click(screen.getByText('Send persistent notifications'));
        await waitFor(() => screen.getByText('Every 5 mins'));

        // Admin default (5) should be selected, not the saved value (2)
        expect(screen.getByRole('menuitemradio', {name: /every 5 mins/i})).toHaveAttribute('aria-checked', 'true');

        await userEvent.click(screen.getByText('Apply'));
        expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
            persistent_notification_interval: 5,
        }));
    });
});
