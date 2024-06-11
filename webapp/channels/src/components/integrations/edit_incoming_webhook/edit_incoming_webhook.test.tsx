// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {IncomingWebhook} from '@mattermost/types/integrations';

import type {ActionResult} from 'mattermost-redux/types/actions';

import EditIncomingWebhook from 'components/integrations/edit_incoming_webhook/edit_incoming_webhook';

import {getHistory} from 'utils/browser_history';
import {TestHelper} from 'utils/test_helper';

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
        const wrapper = shallow(<EditIncomingWebhook {...props}/>);

        expect(wrapper).toMatchSnapshot();
        expect(getIncomingHook).toHaveBeenCalledTimes(1);
        expect(getIncomingHook).toBeCalledWith(props.hookId);
    });

    test('should show AbstractIncomingWebhook', () => {
        const props = {...requiredProps, actions, hook};
        const wrapper = shallow(<EditIncomingWebhook {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should not call getIncomingHook', () => {
        const props = {...requiredProps, enableIncomingWebhooks: false, actions};
        const wrapper = shallow(<EditIncomingWebhook {...props}/>);

        expect(wrapper).toMatchSnapshot();
        expect(getIncomingHook).toHaveBeenCalledTimes(0);
    });

    test('should have called submitHook when editIncomingHook is initiated (no server error)', async () => {
        const newUpdateIncomingHook = jest.fn().mockReturnValue({data: ''});
        const newActions = {...actions, updateIncomingHook: newUpdateIncomingHook};
        const asyncHook = {...hook};
        const props = {...requiredProps, actions: newActions, hook};
        const wrapper = shallow<EditIncomingWebhook>(<EditIncomingWebhook {...props}/>);

        const instance = wrapper.instance();
        await instance.editIncomingHook(asyncHook);
        expect(wrapper).toMatchSnapshot();
        expect(newActions.updateIncomingHook).toHaveBeenCalledTimes(1);
        expect(newActions.updateIncomingHook).toBeCalledWith(asyncHook);
        expect(wrapper.state('serverError')).toEqual('');
    });

    test('should have called submitHook when editIncomingHook is initiated (with server error)', async () => {
        const newUpdateIncomingHook = jest.fn().mockReturnValue({data: ''});
        const newActions = {...actions, updateIncomingHook: newUpdateIncomingHook};
        const asyncHook = {...hook};
        const props = {...requiredProps, actions: newActions, hook};
        const wrapper = shallow<EditIncomingWebhook>(<EditIncomingWebhook {...props}/>);

        const instance = wrapper.instance();
        await instance.editIncomingHook(asyncHook);

        expect(wrapper).toMatchSnapshot();
        expect(newActions.updateIncomingHook).toHaveBeenCalledTimes(1);
        expect(newActions.updateIncomingHook).toBeCalledWith(asyncHook);
    });

    test('should have called submitHook when editIncomingHook is initiated (with data)', async () => {
        const newUpdateIncomingHook = jest.fn().mockReturnValue({data: 'data'});
        const newActions = {...actions, updateIncomingHook: newUpdateIncomingHook};
        const asyncHook = {...hook};
        const props = {...requiredProps, actions: newActions, hook};
        const wrapper = shallow<EditIncomingWebhook>(<EditIncomingWebhook {...props}/>);

        const instance = wrapper.instance();
        await instance.editIncomingHook(asyncHook);

        expect(wrapper).toMatchSnapshot();
        expect(newUpdateIncomingHook).toHaveBeenCalledTimes(1);
        expect(newUpdateIncomingHook).toBeCalledWith(asyncHook);
        expect(wrapper.state('serverError')).toEqual('');
        expect(getHistory().push).toHaveBeenCalledWith(`/${requiredProps.team.name}/integrations/incoming_webhooks`);
    });
});
