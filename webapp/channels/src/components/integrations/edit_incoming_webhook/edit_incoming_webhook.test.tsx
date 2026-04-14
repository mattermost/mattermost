// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {IncomingWebhook} from '@mattermost/types/integrations';
import type {DeepPartial} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import EditIncomingWebhook from 'components/integrations/edit_incoming_webhook/edit_incoming_webhook';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

const initialState: DeepPartial<GlobalState> = {
    entities: {
        channels: {
            currentChannelId: 'channel_id',
            channels: {
                channel_id: TestHelper.getChannelMock({
                    id: 'channel_id',
                    team_id: 'team_id',
                    type: 'O' as ChannelType,
                    name: 'channel_id',
                    display_name: 'Test Channel',
                }),
            },
            myMembers: {
                channel_id: TestHelper.getChannelMembershipMock({channel_id: 'channel_id'}),
            },
            channelsInTeam: {
                team_id: new Set(['channel_id']),
            },
        },
        teams: {
            currentTeamId: 'team_id',
            teams: {
                team_id: TestHelper.getTeamMock({id: 'team_id'}),
            },
            myMembers: {
                team_id: TestHelper.getTeamMembershipMock({roles: 'team_roles'}),
            },
        },
    },
};

describe('components/integrations/EditIncomingWebhook', () => {
    const hook = {
        id: 'id',
        create_at: 0,
        update_at: 10,
        delete_at: 20,
        user_id: 'user_id',
        channel_id: 'channel_id',
        team_id: 'team_id',
        display_name: 'display_name',
        description: 'description',
        username: 'username',
        icon_url: 'http://test/icon.png',
        channel_locked: false,
    };

    const updateIncomingHook = jest.fn();
    const getIncomingHook = jest.fn();
    const actions = {
        updateIncomingHook: updateIncomingHook as (hook: IncomingWebhook) => Promise<ActionResult>,
        getIncomingHook: getIncomingHook as (hookId: string) => Promise<ActionResult>,
    };

    const requiredProps = {
        hookId: 'somehookid',
        teamId: 'testteamid',
        team: TestHelper.getTeamMock(),
        updateIncomingHookRequest: {
            status: 'not_started',
            error: null,
        },
        enableIncomingWebhooks: true,
        enablePostUsernameOverride: true,
        enablePostIconOverride: true,
    };

    afterEach(() => {
        updateIncomingHook.mockReset();
        getIncomingHook.mockReset();
    });

    test('should show Loading screen when no hook is provided', () => {
        const props = {...requiredProps, actions};
        const {container} = renderWithContext(<EditIncomingWebhook {...props}/>, initialState as GlobalState);

        expect(container).toMatchSnapshot();
        expect(getIncomingHook).toHaveBeenCalledTimes(1);
        expect(getIncomingHook).toHaveBeenCalledWith(props.hookId);
    });

    test('should show AbstractIncomingWebhook', () => {
        const props = {...requiredProps, actions, hook};
        const {container} = renderWithContext(<EditIncomingWebhook {...props}/>, initialState as GlobalState);

        expect(container).toMatchSnapshot();
    });

    test('should not call getIncomingHook', () => {
        const props = {...requiredProps, enableIncomingWebhooks: false, actions};
        const {container} = renderWithContext(<EditIncomingWebhook {...props}/>, initialState as GlobalState);

        expect(container).toMatchSnapshot();
        expect(getIncomingHook).toHaveBeenCalledTimes(0);
    });

    test('should have called submitHook when editIncomingHook is initiated (no server error)', async () => {
        const newUpdateIncomingHook = jest.fn().mockReturnValue({data: ''});
        const newActions = {...actions, updateIncomingHook: newUpdateIncomingHook};
        const asyncHook = {...hook};
        const props = {...requiredProps, actions: newActions, hook};
        const {container} = renderWithContext(<EditIncomingWebhook {...props}/>, initialState as GlobalState);

        // Submit the form via the Update button
        const submitButton = screen.getByRole('button', {name: 'Update'});
        await submitButton.click();

        expect(container).toMatchSnapshot();
        expect(newActions.updateIncomingHook).toHaveBeenCalledTimes(1);
        expect(newActions.updateIncomingHook).toHaveBeenCalledWith({
            ...asyncHook,
            id: hook.id,
        });
    });

    test('should have called submitHook when editIncomingHook is initiated (with server error)', async () => {
        const newUpdateIncomingHook = jest.fn().mockReturnValue({data: ''});
        const newActions = {...actions, updateIncomingHook: newUpdateIncomingHook};
        const asyncHook = {...hook};
        const props = {...requiredProps, actions: newActions, hook};
        const {container} = renderWithContext(<EditIncomingWebhook {...props}/>, initialState as GlobalState);

        const submitButton = screen.getByRole('button', {name: 'Update'});
        await submitButton.click();

        expect(container).toMatchSnapshot();
        expect(newActions.updateIncomingHook).toHaveBeenCalledTimes(1);
        expect(newActions.updateIncomingHook).toHaveBeenCalledWith({
            ...asyncHook,
            id: hook.id,
        });
    });

    test('should have called submitHook when editIncomingHook is initiated (with data)', async () => {
        const newUpdateIncomingHook = jest.fn().mockReturnValue({data: 'data'});
        const newActions = {...actions, updateIncomingHook: newUpdateIncomingHook};
        const asyncHook = {...hook};
        const props = {...requiredProps, actions: newActions, hook};
        renderWithContext(<EditIncomingWebhook {...props}/>, initialState as GlobalState);

        const submitButton = screen.getByRole('button', {name: 'Update'});
        await submitButton.click();

        expect(newUpdateIncomingHook).toHaveBeenCalledTimes(1);
        expect(newUpdateIncomingHook).toHaveBeenCalledWith({
            ...asyncHook,
            id: hook.id,
        });
        expect(getHistory().push).toHaveBeenCalledWith(`/${requiredProps.team.name}/integrations/incoming_webhooks`);
    });
});
