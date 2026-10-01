// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {Channel, ChannelType} from '@mattermost/types/channels';
import type {ScheduledPost} from '@mattermost/types/schedule_post';

import {PostTypes} from 'mattermost-redux/constants/posts';
import * as commonSelectors from 'mattermost-redux/selectors/entities/common';
import * as usersSelectors from 'mattermost-redux/selectors/entities/users';

import {useCreateBurnOnReadAccess} from 'components/common/hooks/useCreateBurnOnReadAccess';

import {renderWithContext} from 'tests/react_testing_utils';

import ScheduledPostActions from './scheduled_post_actions';

jest.mock('components/common/hooks/useCreateBurnOnReadAccess', () => ({
    useCreateBurnOnReadAccess: jest.fn(),
}));

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
        isCurrentUserSystemAdminMock = jest.spyOn(usersSelectors, 'isCurrentUserSystemAdmin');
        getMyChannelMembershipsnMock = jest.spyOn(commonSelectors, 'getMyChannelMemberships');

        // Set default return values
        (useCreateBurnOnReadAccess as jest.Mock).mockReset().mockReturnValue(true);
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

    // Edit / Reschedule / Send now all end in a 403 once the author loses the
    // create_burn_on_read_post policy, and Send now's error is swallowed by
    // draft_row.tsx's ignorePostError, so we hide them. Delete and Copy text stay:
    // deleting is the only way out of the state.
    //
    // Feature flags, pending decisions and fetching are useCreateBurnOnReadAccess's own business
    // and are covered by its tests. All this component gets back is a boolean.
    describe('burn-on-read policy gating', () => {
        const burnOnReadPost = {
            ...defaultProps.scheduledPost,
            type: PostTypes.BURN_ON_READ,
        } as ScheduledPost;

        function renderedButtonIds() {
            return screen.getAllByRole('button').map((button) => button.id);
        }

        function expectOnlyDeleteAndCopy() {
            const buttonIds = renderedButtonIds();
            expect(buttonIds).toHaveLength(2);
            expect(buttonIds).toContain('draft_icon-trash-can-outline_delete');
            expect(buttonIds).toContain('draft_icon-content-copy_copy_text');
            expect(buttonIds).not.toContain('draft_icon-pencil-outline_edit');
            expect(buttonIds).not.toContain('draft_icon-clock-send-outline_reschedule');
            expect(buttonIds).not.toContain('draft_icon-send-outline_sendNow');
        }

        it('asks about the post channel', () => {
            renderComponent({...defaultProps, scheduledPost: burnOnReadPost});

            expect(useCreateBurnOnReadAccess).toHaveBeenCalledWith('channel_id');
        });

        // No channel means the hook neither selects nor fetches. This page renders one row per
        // scheduled post, so without that a list of ordinary posts would ask the server for a
        // decision per channel.
        it('asks about no channel on an ordinary scheduled post', () => {
            renderComponent();

            expect(useCreateBurnOnReadAccess).toHaveBeenCalledWith(undefined);
        });

        it('hides edit, reschedule and send now on a denied burn-on-read post', () => {
            (useCreateBurnOnReadAccess as jest.Mock).mockReturnValue(false);

            renderComponent({...defaultProps, scheduledPost: burnOnReadPost});

            expectOnlyDeleteAndCopy();
        });

        // The plausible way to get this wrong is to gate on the decision alone, which
        // would strip the controls off every scheduled post in the list.
        it('leaves an ordinary scheduled post alone when the decision is a deny', () => {
            (useCreateBurnOnReadAccess as jest.Mock).mockReturnValue(false);

            renderComponent();

            expect(renderedButtonIds()).toHaveLength(5);
        });

        it('shows every action on a burn-on-read post the policy allows', () => {
            (useCreateBurnOnReadAccess as jest.Mock).mockReturnValue(true);

            renderComponent({...defaultProps, scheduledPost: burnOnReadPost});

            expect(renderedButtonIds()).toHaveLength(5);
        });

        // The isAdmin bypass exists for membership and archived channels — "an admin may act
        // outside their own membership". ABAC is not that: HasPermissionToChannelAction hands
        // the session's roles to the PDP, whose RoleFallback maps system_admin -> system_user,
        // so an admin with no admin-scoped policy is denied exactly like a member.
        it('hides the actions for a system admin too', () => {
            isCurrentUserSystemAdminMock.mockReturnValue(true);
            (useCreateBurnOnReadAccess as jest.Mock).mockReturnValue(false);

            renderComponent({...defaultProps, scheduledPost: burnOnReadPost});

            expectOnlyDeleteAndCopy();
        });
    });
});
