// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {Link} from 'react-router-dom';

import DeleteIntegrationLink from 'components/integrations/delete_integration_link';
import InstalledOutgoingWebhook, {matchesFilter} from 'components/integrations/installed_outgoing_webhook';

import {TestHelper} from 'utils/test_helper';

import type {Channel} from '@mattermost/types/channels';
import type {OutgoingWebhook} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

describe('components/integrations/InstalledOutgoingWebhook', () => {
    const team: Team = TestHelper.getTeamMock({
        id: 'testteamid',
        name: 'test',
    });

    const channel: Channel = TestHelper.getChannelMock({
        id: '1jiw9kphbjrntfyrm7xpdcya4o',
        name: 'town-square',
        display_name: 'Town Square',
    });

    const userProfile: UserProfile = TestHelper.getUserMock();

    const outgoingWebhook: OutgoingWebhook = TestHelper.getOutgoingWebhookMock({
        callback_urls: ['http://adsfdasd.com'],
        channel_id: 'mdpzfpfcxi85zkkqkzkch4b85h',
        content_type: 'application/x-www-form-urlencoded',
        create_at: 1508327769020,
        creator_id: 'zaktnt8bpbgu8mb6ez9k64r7sa',
        delete_at: 0,
        description: 'build status',
        display_name: 'build',
        id: '7h88x419ubbyuxzs7dfwtgkffr',
        team_id: 'eatxocwc3bg9ffo9xyybnj4omr',
        token: 'xoxz1z7c3tgi9xhrfudn638q9r',
        trigger_when: 0,
        trigger_words: ['build'],
        update_at: 1508329149618,
        username: 'hook_user_name',

    });

    const baseProps = {
        outgoingWebhook,
        onRegenToken: () => {}, //eslint-disable-line no-empty-function
        onDelete: () => {}, //eslint-disable-line no-empty-function
        filter: '',
        creator: userProfile,
        canChange: true,
        team,
        channel,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <InstalledOutgoingWebhook {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should not have edit and delete actions if user does not have permissions to change', () => {
        const newCanChange = false;
        const props = {...baseProps, canChange: newCanChange};
        const wrapper = shallow(
            <InstalledOutgoingWebhook {...props}/>,
        );
        expect(wrapper.find('.item-actions').length).toBe(0);
    });

    test('should have edit and delete actions if user can change webhook', () => {
        const wrapper = shallow(
            <InstalledOutgoingWebhook {...baseProps}/>,
        );
        expect(wrapper.find('.item-actions').find(Link).exists()).toBe(true);
        expect(wrapper.find('.item-actions').find(DeleteIntegrationLink).exists()).toBe(true);
    });

    test('Should have the same name and description on view as it has in outgoingWebhook', () => {
        const newCanChange = false;
        const props = {...baseProps, canChange: newCanChange};
        const wrapper = shallow(
            <InstalledOutgoingWebhook {...props}/>,
        );

        expect(wrapper.find('.item-details__description').text()).toBe('build status');
        expect(wrapper.find('.item-details__name').text()).toBe('build');
    });

    test('Should not display description as it is null', () => {
        const newOutgoingWebhook = TestHelper.getOutgoingWebhookMock({...outgoingWebhook, description: undefined});
        const props = {...baseProps, outgoingWebhook: newOutgoingWebhook};
        const wrapper = shallow(
            <InstalledOutgoingWebhook {...props}/>,
        );

        expect(wrapper.find('.item-details__description').length).toBe(0);
    });

    test('Should not render any nodes as there are no filtered results', () => {
        const newFilter = 'someLongText';
        const props = {...baseProps, filter: newFilter};
        const wrapper = shallow(
            <InstalledOutgoingWebhook {...props}/>,
        );

        expect(wrapper.getElement()).toBe(null);
    });

    test('Should render a webhook item as filtered result is true', () => {
        const newFilter = 'buil';
        const props = {...baseProps, filter: newFilter};
        const wrapper = shallow(
            <InstalledOutgoingWebhook {...props}/>,
        );

        expect(wrapper.find('.item-details').exists()).toBe(true);
    });

    test('Should call onRegenToken function once', () => {
        const newFilter = 'buil';
        const newOnRegenToken = jest.fn();
        const props = {...baseProps, filter: newFilter, onRegenToken: newOnRegenToken};

        const wrapper = shallow(
            <InstalledOutgoingWebhook {...props}/>,
        );

        wrapper.find('.item-actions button').first().simulate('click', {preventDefault() {
            return jest.fn();
        }});
        expect(newOnRegenToken).toHaveBeenCalledTimes(1);
    });

    test('Should call onDelete function once', () => {
        const newFilter = 'buil';
        const newOnDelete = jest.fn();
        const props = {...baseProps, filter: newFilter, onDelete: newOnDelete};

        const wrapper = shallow(
            <InstalledOutgoingWebhook {...props}/>,
        );

        wrapper.find(DeleteIntegrationLink).first().prop('onDelete')();
        expect(newOnDelete).toHaveBeenCalledTimes(1);
    });

    test('Should match snapshot of makeDisplayName', () => {
        const wrapper = shallow(
            <InstalledOutgoingWebhook {...baseProps}/>,
        );

        const instance = wrapper.instance() as InstalledOutgoingWebhook;

        // displays webhook's display name
        expect(instance.makeDisplayName(TestHelper.getOutgoingWebhookMock({display_name: 'hook display name'}), TestHelper.getChannelMock())).toMatchSnapshot();

        // displays channel's display name
        expect(instance.makeDisplayName(TestHelper.getOutgoingWebhookMock(), TestHelper.getChannelMock({display_name: 'channel display name'}))).toMatchSnapshot();

        // displays a private hook
        expect(instance.makeDisplayName(TestHelper.getOutgoingWebhookMock(), TestHelper.getChannelMock())).toMatchSnapshot();
    });

    test('Should match result when matchesFilter is called', () => {
        expect(matchesFilter(TestHelper.getOutgoingWebhookMock(), TestHelper.getChannelMock(), 'word')).toEqual(false);
        expect(matchesFilter(TestHelper.getOutgoingWebhookMock({display_name: undefined}), TestHelper.getChannelMock(), 'word')).toEqual(false);
        expect(matchesFilter(TestHelper.getOutgoingWebhookMock({description: undefined}), TestHelper.getChannelMock(), 'word')).toEqual(false);
        expect(matchesFilter(TestHelper.getOutgoingWebhookMock({trigger_words: undefined}), TestHelper.getChannelMock(), 'word')).toEqual(false);
        expect(matchesFilter(TestHelper.getOutgoingWebhookMock(), TestHelper.getChannelMock({name: undefined}), 'channel')).toEqual(false);

        expect(matchesFilter(TestHelper.getOutgoingWebhookMock(), TestHelper.getChannelMock(), '')).toEqual(true);
        expect(matchesFilter(TestHelper.getOutgoingWebhookMock({display_name: 'Word'}), TestHelper.getChannelMock(), 'word')).toEqual(true);
        expect(matchesFilter(TestHelper.getOutgoingWebhookMock({display_name: 'word'}), TestHelper.getChannelMock(), 'word')).toEqual(true);
        expect(matchesFilter(TestHelper.getOutgoingWebhookMock({description: 'Trigger description'}), TestHelper.getChannelMock(), 'description')).toEqual(true);

        expect(matchesFilter(TestHelper.getOutgoingWebhookMock({trigger_words: ['Trigger']}), TestHelper.getChannelMock(), 'trigger')).toEqual(true);
        expect(matchesFilter(TestHelper.getOutgoingWebhookMock({trigger_words: ['word', 'Trigger']}), TestHelper.getChannelMock(), 'trigger')).toEqual(true);

        expect(matchesFilter(TestHelper.getOutgoingWebhookMock(), TestHelper.getChannelMock({name: 'channel_name'}), 'channel')).toEqual(true);
    });
});
