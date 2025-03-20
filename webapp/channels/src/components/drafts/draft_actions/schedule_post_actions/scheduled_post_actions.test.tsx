// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {Channel, ChannelType} from '@mattermost/types/channels';
import type {ScheduledPost} from '@mattermost/types/schedule_post';

import * as commonSelectors from 'mattermost-redux/selectors/entities/common';
import * as usersSelectors from 'mattermost-redux/selectors/entities/users';

import {renderWithContext} from 'tests/react_testing_utils';

import ScheduledPostActions from './scheduled_post_actions';

const initialState = {
    entities: {
        users: {
            currentUserId: 'user_id',
            profiles: {
                user_id: {
                    roles: 'custom_role',
                    timezone: {
                        useAutomaticTimezone: true,
                        automaticTimezone: '',
                        manualTimezone: '',
                    },
                },
            },
        },
        general: {
            config: {},
            license: {},
        },
        channels: {
            currentChannelId: 'channel_id',
            channels: {
                channel_id: {
                    id: 'channel_id',
                    type: 'O' as ChannelType,
                    display_name: 'Test Channel',
                    delete_at: 0,
                },
            },
        },
        roles: {
            roles: {},
        },
    },
};

const defaultProps = {
    scheduledPost: {
        id: 'scheduled_post_id',
        channel_id: 'channel_id',
        scheduled_at: Date.now(),
        error_code: null,
        create_at: Date.now(),
        update_at: Date.now(),
        user_id: 'user_id',
        root_id: '',
        message: 'Test message',
        props: {},
        metadata: {},
    } as unknown as ScheduledPost,
    channel: {
        id: 'channel_id',
        type: 'O' as ChannelType,
        display_name: 'Test Channel',
        delete_at: 0,
    } as Channel,
    onReschedule: jest.fn(),
    onDelete: jest.fn(),
    onSend: jest.fn(),
    onEdit: jest.fn(),
    onCopyText: jest.fn(),
};

describe('ScheduledPostActions Component', () => {
    let isCurrentUserSystemAdminMock: jest.SpyInstance;
    let getMyChannelMembershipsnMock: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    beforeEach(() => {
        jest.clearAllMocks();

        isCurrentUserSystemAdminMock = jest.spyOn(usersSelectors, 'isCurrentUserSystemAdmin');
        getMyChannelMembershipsnMock = jest.spyOn(commonSelectors, 'getMyChannelMemberships');

        // Set default return values
        isCurrentUserSystemAdminMock.mockReturnValue(false);
        getMyChannelMembershipsnMock.mockReturnValue({
            channel_id: {
                channel_id: 'channel_id',
                user_id: 'user_id',
                roles: 'channel_user',
            },
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function renderComponent(props = defaultProps, state = initialState) {
        return renderWithContext(
            <ScheduledPostActions
                {...defaultProps}
                {...props}
            />,
            state,
        );
    }
    it('should render all action buttons when user is an ADMIN', () => {
        isCurrentUserSystemAdminMock.mockReturnValue(true);

        renderComponent();

        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(5);

        const buttonIds = buttons.map((button) => button.id);
        expect(buttonIds).toContain('draft_icon-trash-can-outline_delete');
        expect(buttonIds).toContain('draft_icon-pencil-outline_edit');
        expect(buttonIds).toContain('draft_icon-content-copy_copy_text');
        expect(buttonIds).toContain('draft_icon-clock-send-outline_reschedule');
        expect(buttonIds).toContain('draft_icon-send-outline_sendNow');
    });

    it('should render appropriate action buttons when user is NOT an admin but IS member of the channel', () => {
        isCurrentUserSystemAdminMock.mockReturnValue(false);

        renderComponent();

        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(5);

        const buttonIds = buttons.map((button) => button.id);
        expect(buttonIds).toContain('draft_icon-trash-can-outline_delete');
        expect(buttonIds).toContain('draft_icon-pencil-outline_edit');
        expect(buttonIds).toContain('draft_icon-content-copy_copy_text');
        expect(buttonIds).toContain('draft_icon-clock-send-outline_reschedule');
        expect(buttonIds).toContain('draft_icon-send-outline_sendNow');
    });

    it('should only render delete and copy text button when regular user is NOT member of the channel', () => {
        isCurrentUserSystemAdminMock.mockReturnValue(false);

        // Regular User is not a member of the channel
        getMyChannelMembershipsnMock.mockReturnValue({});

        renderComponent();

        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(2);

        const buttonIds = buttons.map((button) => button.id);
        expect(buttonIds).toContain('draft_icon-trash-can-outline_delete');
        expect(buttonIds).toContain('draft_icon-content-copy_copy_text');

        // validate action buttons are not present
        expect(buttonIds).not.toContain('draft_icon-send-outline_sendNow');
        expect(buttonIds).not.toContain('draft_icon-pencil-outline_edit');
        expect(buttonIds).not.toContain('draft_icon-clock-send-outline_reschedule');
    });

    it('should render all action buttons when user is not member of the channel but is an admin', () => {
        isCurrentUserSystemAdminMock.mockReturnValue(true);
        getMyChannelMembershipsnMock.mockReturnValue({});

        renderComponent();

        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(5);

        const buttonIds = buttons.map((button) => button.id);
        expect(buttonIds).toContain('draft_icon-trash-can-outline_delete');
        expect(buttonIds).toContain('draft_icon-pencil-outline_edit');
        expect(buttonIds).toContain('draft_icon-content-copy_copy_text');
        expect(buttonIds).toContain('draft_icon-clock-send-outline_reschedule');
        expect(buttonIds).toContain('draft_icon-send-outline_sendNow');
    });

    it('should only render delete and copy text buttons when the channel is archived and is regular user', () => {
        const archivedChannelProps = {
            ...defaultProps,
            channel: {
                ...defaultProps.channel,
                delete_at: 1,
            } as Channel,
        };

        renderComponent(archivedChannelProps);

        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(2);

        const buttonIds = buttons.map((button) => button.id);
        expect(buttonIds).toContain('draft_icon-trash-can-outline_delete');
        expect(buttonIds).toContain('draft_icon-content-copy_copy_text');

        // Validate that other action buttons are not present
        expect(buttonIds).not.toContain('draft_icon-send-outline_sendNow');
        expect(buttonIds).not.toContain('draft_icon-pencil-outline_edit');
        expect(buttonIds).not.toContain('draft_icon-clock-send-outline_reschedule');
    });

    it('should render all action buttons when the channel is archived and the user is admin', () => {
        const archivedChannelProps = {
            ...defaultProps,
            channel: {
                ...defaultProps.channel,
                delete_at: 1,
            } as Channel,
        };

        isCurrentUserSystemAdminMock.mockReturnValue(true);

        renderComponent(archivedChannelProps);

        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(5);

        const buttonIds = buttons.map((button) => button.id);
        expect(buttonIds).toContain('draft_icon-trash-can-outline_delete');
        expect(buttonIds).toContain('draft_icon-content-copy_copy_text');
        expect(buttonIds).toContain('draft_icon-send-outline_sendNow');
        expect(buttonIds).toContain('draft_icon-pencil-outline_edit');
        expect(buttonIds).toContain('draft_icon-clock-send-outline_reschedule');
    });
});
