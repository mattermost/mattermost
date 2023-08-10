// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import InstalledOutgoingWebhooks from 'components/integrations/installed_outgoing_webhooks/installed_outgoing_webhooks';

import {TestHelper} from 'utils/test_helper';

import type {OutgoingWebhook} from '@mattermost/types/integrations';
import type {ComponentProps} from 'react';

describe('components/integrations/InstalledOutgoingWebhooks', () => {
    const teamId = 'testteamid';
    const team = TestHelper.getTeamMock({
        id: teamId,
        name: 'test',
    });
    const user = TestHelper.getUserMock({
        first_name: 'sudheer',
        id: 'zaktnt8bpbgu8mb6ez9k64r7sa',
        roles: 'system_admin system_user',
        username: 'sudheerdev',
    });
    const channel = TestHelper.getChannelMock({
        id: 'mdpzfpfcxi85zkkqkzkch4b85h',
        name: 'town-square',
        display_name: 'town-square',
    });
    const outgoingWebhooks = [
        {
            callback_urls: ['http://adsfdasd.com'],
            channel_id: 'mdpzfpfcxi85zkkqkzkch4b85h',
            content_type: 'application/x-www-form-urlencoded',
            create_at: 1508327769020,
            creator_id: 'zaktnt8bpbgu8mb6ez9k64r7sa',
            delete_at: 0,
            description: 'build status',
            display_name: '',
            id: '7h88x419ubbyuxzs7dfwtgkfgr',
            team_id: 'eatxocwc3bg9ffo9xyybnj4omr',
            token: 'xoxz1z7c3tgi9xhrfudn638q9r',
            trigger_when: 0,
            trigger_words: ['build'],
            0: 'asdf',
            update_at: 1508329149618,
        } as unknown as OutgoingWebhook,
        {
            callback_urls: ['http://adsfdasd.com'],
            channel_id: 'mdpzfpfcxi85zkkqkzkch4b85h',
            content_type: 'application/x-www-form-urlencoded',
            create_at: 1508327769020,
            creator_id: 'zaktnt8bpbgu8mb6ez9k64r7sa',
            delete_at: 0,
            description: 'test',
            display_name: '',
            id: '7h88x419ubbyuxzs7dfwtgkffr',
            team_id: 'eatxocwc3bg9ffo9xyybnj4omr',
            token: 'xoxz1z7c3tgi9xhrfudn638q9r',
            trigger_when: 0,
            trigger_words: ['test'],
            0: 'asdf',
            update_at: 1508329149618,
        } as unknown as OutgoingWebhook,
    ];

    const defaultProps: ComponentProps<typeof InstalledOutgoingWebhooks> = {
        outgoingWebhooks,
        teamId,
        team,
        user,
        users: {zaktnt8bpbgu8mb6ez9k64r7sa: user},
        channels: {mdpzfpfcxi85zkkqkzkch4b85h: channel},
        actions: {
            removeOutgoingHook: jest.fn(),
            loadOutgoingHooksAndProfilesForTeam: jest.fn().mockReturnValue(Promise.resolve()),
            regenOutgoingHookToken: jest.fn(),
        },
        enableOutgoingWebhooks: true,
        canManageOthersWebhooks: true,
    };

    test('should match snapshot', () => {
        const wrapper = shallow<InstalledOutgoingWebhooks>(
            <InstalledOutgoingWebhooks
                {...defaultProps}
            />,
        );
        expect(shallow(<div>{wrapper.instance().outgoingWebhooks('town')}</div>)).toMatchSnapshot();
        expect(shallow(<div>{wrapper.instance().outgoingWebhooks('ZZZ')}</div>)).toMatchSnapshot();
        expect(wrapper).toMatchSnapshot();
    });

    test('should call regenOutgoingHookToken function', () => {
        const wrapper = shallow<InstalledOutgoingWebhooks>(
            <InstalledOutgoingWebhooks
                {...defaultProps}
            />,
        );
        wrapper.instance().regenOutgoingWebhookToken(outgoingWebhooks[0]);
        expect(defaultProps.actions.regenOutgoingHookToken).toHaveBeenCalledTimes(1);
        expect(defaultProps.actions.regenOutgoingHookToken).toHaveBeenCalledWith(outgoingWebhooks[0].id);
    });

    test('should call removeOutgoingHook function', () => {
        const wrapper = shallow<InstalledOutgoingWebhooks>(
            <InstalledOutgoingWebhooks
                {...defaultProps}
            />,
        );

        wrapper.instance().removeOutgoingHook(outgoingWebhooks[1]);
        expect(defaultProps.actions.removeOutgoingHook).toHaveBeenCalledTimes(1);
        expect(defaultProps.actions.removeOutgoingHook).toHaveBeenCalledWith(outgoingWebhooks[1].id);
        expect(defaultProps.actions.removeOutgoingHook).toHaveBeenCalled();
    });
});
