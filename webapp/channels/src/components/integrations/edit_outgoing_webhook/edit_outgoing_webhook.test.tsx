// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {OutgoingWebhook} from '@mattermost/types/integrations';
import type {DeepPartial} from '@mattermost/types/utilities';

import EditOutgoingWebhook from 'components/integrations/edit_outgoing_webhook/edit_outgoing_webhook';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

const mockPush = jest.fn();
jest.mock('utils/browser_history', () => ({
    getHistory: () => ({push: mockPush}),
}));

const initialState: DeepPartial<GlobalState> = {
    entities: {
        channels: {
            currentChannelId: 'current_channel_id',
            channels: {
                current_channel_id: TestHelper.getChannelMock({
                    id: 'current_channel_id',
                    team_id: 'current_team_id',
                    type: 'O' as ChannelType,
                    name: 'current_channel',
                }),
            },
            myMembers: {
                current_channel_id: TestHelper.getChannelMembershipMock({channel_id: 'current_channel_id'}),
            },
            channelsInTeam: {
                current_team_id: new Set(['current_channel_id']),
            },
        },
        teams: {
            currentTeamId: 'current_team_id',
            teams: {
                current_team_id: TestHelper.getTeamMock({id: 'current_team_id'}),
            },
            myMembers: {
                current_team_id: TestHelper.getTeamMembershipMock({roles: 'team_roles'}),
            },
        },
    },
};

describe('components/integrations/EditOutgoingWebhook', () => {
    const team = TestHelper.getTeamMock();
    const hook: OutgoingWebhook = {
        icon_url: '',
        username: '',
        id: 'ne8miib4dtde5jmgwqsoiwxpiy',
        token: 'nbxtx9hkhb8a5q83gw57jzi9cc',
        create_at: 1504447824673,
        update_at: 1504447824673,
        delete_at: 0,
        creator_id: '88oybd1dwfdoxpkpw1h5kpbyco',
        channel_id: 'r18hw9hgq3gtiymtpb6epf8qtr',
        team_id: 'm5gix3oye3du8ghk4ko6h9cq7y',
        trigger_words: ['trigger', 'trigger2'],
        trigger_when: 0,
        callback_urls: ['https://test.com/callback', 'https://test.com/callback2'],
        display_name: 'name',
        description: 'description',
        content_type: 'application/json',
    };
    const updateOutgoingHookRequest = {
        status: 'not_started',
        error: null,
    };
    const baseProps = {
        team,
        hookId: 'hook_id',
        updateOutgoingHookRequest,
        actions: {
            updateOutgoingHook: jest.fn(),
            getOutgoingHook: jest.fn(),
        },
        enableOutgoingWebhooks: true,
        enablePostUsernameOverride: false,
        enablePostIconOverride: false,
    };

    beforeEach(() => {
        mockPush.mockClear();
    });

    test('should match snapshot', () => {
        const props = {...baseProps, hook};
        const {container} = renderWithContext(
            <EditOutgoingWebhook {...props}/>,
            initialState as GlobalState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loading', () => {
        const {container} = renderWithContext(
            <EditOutgoingWebhook {...baseProps}/>,
            initialState as GlobalState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when EnableOutgoingWebhooks is false', () => {
        const props = {...baseProps, enableOutgoingWebhooks: false, hook};
        const {container} = renderWithContext(
            <EditOutgoingWebhook {...props}/>,
            initialState as GlobalState,
        );

        expect(container).toMatchSnapshot();
    });

    test('should have match state when handleConfirmModal is called', async () => {
        const newActions = {
            ...baseProps.actions,
            updateOutgoingHook: jest.fn().mockReturnValue({data: 'data'}),
        };
        const props = {...baseProps, hook, actions: newActions};
        const {container} = renderWithContext(
            <EditOutgoingWebhook {...props}/>,
            initialState as GlobalState,
        );

        // Change the callback URLs to trigger the confirm modal
        const callbackUrlsTextarea = container.querySelector('#callbackUrls') as HTMLTextAreaElement;
        await userEvent.clear(callbackUrlsTextarea);
        await userEvent.type(callbackUrlsTextarea, 'https://different.com/callback');

        // Submit form to trigger editOutgoingHook which detects callback_urls change and calls handleConfirmModal
        await userEvent.click(container.querySelector('#saveWebhook') as HTMLButtonElement);

        // The confirm modal should now be visible
        await waitFor(() => {
            expect(screen.getByText('Your changes may break the existing outgoing webhook. Are you sure you would like to update it?')).toBeInTheDocument();
        });
    });

    test('should have match state when confirmModalDismissed is called', async () => {
        const newActions = {
            ...baseProps.actions,
            updateOutgoingHook: jest.fn().mockReturnValue({data: 'data'}),
        };
        const props = {...baseProps, hook, actions: newActions};
        const {container} = renderWithContext(
            <EditOutgoingWebhook {...props}/>,
            initialState as GlobalState,
        );

        // Change callback URLs to trigger confirm modal
        const callbackUrlsTextarea = container.querySelector('#callbackUrls') as HTMLTextAreaElement;
        await userEvent.clear(callbackUrlsTextarea);
        await userEvent.type(callbackUrlsTextarea, 'https://different.com/callback');

        await userEvent.click(container.querySelector('#saveWebhook') as HTMLButtonElement);

        await waitFor(() => {
            expect(screen.getByText('Your changes may break the existing outgoing webhook. Are you sure you would like to update it?')).toBeInTheDocument();
        });

        // Click cancel to dismiss the confirm modal
        await userEvent.click(screen.getByTestId('cancel-button'));

        await waitFor(() => {
            expect(screen.queryByText('Your changes may break the existing outgoing webhook. Are you sure you would like to update it?')).not.toBeInTheDocument();
        });
    });

    test('should have match renderExtra', () => {
        const props = {...baseProps, hook};
        const {container} = renderWithContext(
            <EditOutgoingWebhook {...props}/>,
            initialState as GlobalState,
        );

        // renderExtra renders a ConfirmModal - verify its presence in the DOM
        expect(container.querySelector('.integrations-backstage-modal')).toMatchSnapshot();
    });

    test('should have match when editOutgoingHook is called', async () => {
        const newActions = {
            ...baseProps.actions,
            updateOutgoingHook: jest.fn().mockReturnValue({data: 'data'}),
        };
        const props = {...baseProps, hook, actions: newActions};
        const {container} = renderWithContext(
            <EditOutgoingWebhook {...props}/>,
            initialState as GlobalState,
        );

        // Submit form without changing content_type, trigger_words or callback_urls
        // should call submitHook directly (no confirm modal)
        await userEvent.click(container.querySelector('#saveWebhook') as HTMLButtonElement);

        // No confirm modal should appear since nothing breaking changed
        expect(screen.queryByText('Your changes may break the existing outgoing webhook. Are you sure you would like to update it?')).not.toBeInTheDocument();

        // submitHook should have been called which calls updateOutgoingHook
        expect(newActions.updateOutgoingHook).toHaveBeenCalled();
    });

    test('should have match when submitHook is called on success', async () => {
        const newActions = {
            ...baseProps.actions,
            updateOutgoingHook: jest.fn().mockReturnValue({data: 'data'}),
        };
        const props = {...baseProps, hook, actions: newActions};
        const {container} = renderWithContext(
            <EditOutgoingWebhook {...props}/>,
            initialState as GlobalState,
        );

        // Submit form - no breaking changes so submitHook is called directly
        await userEvent.click(container.querySelector('#saveWebhook') as HTMLButtonElement);

        expect(newActions.updateOutgoingHook).toHaveBeenCalledTimes(1);
        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith(`/${team.name}/integrations/outgoing_webhooks`);
        });
    });

    test('should have match when submitHook is called on error', async () => {
        const newActions = {
            ...baseProps.actions,
            updateOutgoingHook: jest.fn().mockReturnValue({data: ''}),
        };
        const props = {...baseProps, hook, actions: newActions};
        const {container} = renderWithContext(
            <EditOutgoingWebhook {...props}/>,
            initialState as GlobalState,
        );

        // Submit form
        await userEvent.click(container.querySelector('#saveWebhook') as HTMLButtonElement);

        expect(newActions.updateOutgoingHook).toHaveBeenCalledTimes(1);
    });
});
