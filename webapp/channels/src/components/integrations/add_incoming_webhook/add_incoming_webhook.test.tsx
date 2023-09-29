// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import AddIncomingWebhook from 'components/integrations/add_incoming_webhook/add_incoming_webhook';

import {TestHelper} from 'utils/test_helper';

describe('components/integrations/AddIncomingWebhook', () => {
    const createIncomingHook = jest.fn().mockResolvedValue({data: true});
    const props = {
        team: TestHelper.getTeamMock({
            id: 'testteamid',
            name: 'test',
        }),
        enablePostUsernameOverride: true,
        enablePostIconOverride: true,
        actions: {createIncomingHook},
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<AddIncomingWebhook {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should have called createIncomingHook', () => {
        const hook = TestHelper.getIncomingWebhookMock({
            channel_id: 'channel_id',
            display_name: 'display_name',
            description: 'description',
            username: 'username',
            icon_url: 'icon_url',
        });
        const wrapper = shallow<AddIncomingWebhook>(<AddIncomingWebhook {...props}/>);
        wrapper.instance().addIncomingHook(hook);
        expect(createIncomingHook).toHaveBeenCalledTimes(1);
        expect(createIncomingHook).toBeCalledWith(hook);
    });
});
