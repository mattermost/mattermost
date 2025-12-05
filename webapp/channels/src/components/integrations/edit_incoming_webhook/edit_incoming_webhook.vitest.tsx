// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {IncomingWebhook} from '@mattermost/types/integrations';

import type {ActionResult} from 'mattermost-redux/types/actions';

import EditIncomingWebhook from 'components/integrations/edit_incoming_webhook/edit_incoming_webhook';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

vi.mock('utils/browser_history', () => ({
    getHistory: vi.fn(() => ({
        push: vi.fn(),
    })),
}));

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

    const updateIncomingHook = vi.fn();
    const getIncomingHook = vi.fn();
    const actions = {
        updateIncomingHook: updateIncomingHook as unknown as (hook: IncomingWebhook) => Promise<ActionResult>,
        getIncomingHook: getIncomingHook as unknown as (hookId: string) => Promise<ActionResult>,
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
        const {container} = renderWithContext(<EditIncomingWebhook {...props}/>);

        expect(container).toMatchSnapshot();
        expect(getIncomingHook).toHaveBeenCalledTimes(1);
        expect(getIncomingHook).toHaveBeenCalledWith(props.hookId);
    });

    test('should show AbstractIncomingWebhook', () => {
        const props = {...requiredProps, actions, hook};
        const {container} = renderWithContext(<EditIncomingWebhook {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should not call getIncomingHook', () => {
        const props = {...requiredProps, enableIncomingWebhooks: false, actions};
        const {container} = renderWithContext(<EditIncomingWebhook {...props}/>);

        expect(container).toMatchSnapshot();
        expect(getIncomingHook).toHaveBeenCalledTimes(0);
    });

    test('should have called submitHook when editIncomingHook is initiated (no server error)', async () => {
        const newUpdateIncomingHook = vi.fn().mockReturnValue({data: ''});
        const newActions = {...actions, updateIncomingHook: newUpdateIncomingHook};
        const props = {...requiredProps, actions: newActions, hook};
        const {container} = renderWithContext(<EditIncomingWebhook {...props}/>);

        expect(container).toMatchSnapshot();

        // Form shows "Edit" title
        expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    test('should have called submitHook when editIncomingHook is initiated (with server error)', async () => {
        const newUpdateIncomingHook = vi.fn().mockReturnValue({data: ''});
        const newActions = {...actions, updateIncomingHook: newUpdateIncomingHook};
        const props = {...requiredProps, actions: newActions, hook};
        const {container} = renderWithContext(<EditIncomingWebhook {...props}/>);

        expect(container).toMatchSnapshot();

        // Form shows "Edit" title
        expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    test('should have called submitHook when editIncomingHook is initiated (with data)', async () => {
        const newUpdateIncomingHook = vi.fn().mockReturnValue({data: 'data'});
        const newActions = {...actions, updateIncomingHook: newUpdateIncomingHook};
        const props = {...requiredProps, actions: newActions, hook};
        const {container} = renderWithContext(<EditIncomingWebhook {...props}/>);

        expect(container).toMatchSnapshot();

        // Form shows "Edit" title
        expect(screen.getByText('Edit')).toBeInTheDocument();
    });
});
