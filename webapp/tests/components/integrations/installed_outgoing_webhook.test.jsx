// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';
import {Link} from 'react-router';
import DeleteIntegration from 'components/integrations/components/delete_integration.jsx';
import InstalledOutgoingWebhook from 'components/integrations/components/installed_outgoing_webhook.jsx';

describe('components/integrations/InstalledOutgoingWebhook', () => {
    let outgoingWebhook = {};
    const teamId = 'testteamid';
    beforeEach(() => {
        outgoingWebhook = {
            id: 'p9as8ynnzpfzjryk5ihnu4s9sr',
            token: 'nepymfk8sid9pddzbp6ixw8orh',
            create_at: 1502533927728,
            update_at: 1502538255834,
            delete_at: 0,
            creator_id: 'zaktnt8bpbgu8mb6ez9k64r7sa',
            channel_id: '1jiw9kphbjrntfyrm7xpdcya4o',
            team_id: 'eatxocwc3bg9ffo9xyybnj4omr',
            trigger_words: ['issue'],
            trigger_when: 0,
            callback_urls: ['https://someurliamnotsureof.com'],
            display_name: 'issue',
            description: 'new issues created',
            content_type: 'application/json'
        };
    });

    test('should match snapshot', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const wrapper = shallow(
            <InstalledOutgoingWebhook
                key={1}
                outgoingWebhook={outgoingWebhook}
                onRegenToken={emptyFunction}
                onDelete={emptyFunction}
                creator={{}}
                canChange={true}
                team={{
                    id: teamId,
                    name: 'test'
                }}
                channel={{
                    id: '1jiw9kphbjrntfyrm7xpdcya4o',
                    name: 'town-square'
                }}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should not have actions links if user does not have permissions to change webhook', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const wrapper = shallow(
            <InstalledOutgoingWebhook
                key={1}
                outgoingWebhook={outgoingWebhook}
                onRegenToken={emptyFunction}
                onDelete={emptyFunction}
                creator={{}}
                canChange={false}
                team={{
                    id: teamId,
                    name: 'test'
                }}
                channel={{
                    id: '1jiw9kphbjrntfyrm7xpdcya4o',
                    name: 'town-square'
                }}
            />
        );
        expect(wrapper.find('.item-actions').length).toBe(0);
    });

    test('should have edit and delete actions if user can change webhook', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const wrapper = shallow(
            <InstalledOutgoingWebhook
                key={1}
                outgoingWebhook={outgoingWebhook}
                onRegenToken={emptyFunction}
                onDelete={emptyFunction}
                creator={{}}
                canChange={true}
                team={{
                    id: teamId,
                    name: 'test'
                }}
                channel={{
                    id: '1jiw9kphbjrntfyrm7xpdcya4o',
                    name: 'town-square'
                }}
            />
        );
        expect(wrapper.find('.item-actions').find('a').exists()).toBe(true);
        expect(wrapper.find('.item-actions').find(Link).exists()).toBe(true);
        expect(wrapper.find('.item-actions').find(DeleteIntegration).exists()).toBe(true);
    });

    test('Should have the same name and description on view as it has in outgoingWebhook', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const wrapper = shallow(
            <InstalledOutgoingWebhook
                key={1}
                outgoingWebhook={outgoingWebhook}
                onRegenToken={emptyFunction}
                onDelete={emptyFunction}
                creator={{}}
                canChange={false}
                team={{
                    id: teamId,
                    name: 'test'
                }}
                channel={{
                    id: '1jiw9kphbjrntfyrm7xpdcya4o',
                    name: 'town-square'
                }}
            />
        );

        expect(wrapper.find('.item-details__description').text()).toBe('new issues created');
        expect(wrapper.find('.item-details__name').text()).toBe('issue');
    });

    test('Should not display description as it is null', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function
        outgoingWebhook.description = null;
        const wrapper = shallow(
            <InstalledOutgoingWebhook
                key={1}
                outgoingWebhook={outgoingWebhook}
                onRegenToken={emptyFunction}
                onDelete={emptyFunction}
                creator={{}}
                canChange={false}
                team={{
                    id: teamId,
                    name: 'test'
                }}
                channel={{
                    id: '1jiw9kphbjrntfyrm7xpdcya4o',
                    name: 'town-square'
                }}
            />
        );
        expect(wrapper.find('.item-details__description').length).toBe(0);
    });

    test('Should not render any nodes as there are no filtered results', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function
        const wrapper = shallow(
            <InstalledOutgoingWebhook
                key={1}
                outgoingWebhook={outgoingWebhook}
                onRegenToken={emptyFunction}
                onDelete={emptyFunction}
                creator={{}}
                filter={'someLongText'}
                canChange={false}
                team={{
                    id: teamId,
                    name: 'test'
                }}
                channel={{
                    id: '1jiw9kphbjrntfyrm7xpdcya4o',
                    name: 'town-square'
                }}
            />
        );
        expect(wrapper.getNode()).toBe(null);
    });

    test('Should render a webhook item as filtered result is true', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function
        const wrapper = shallow(
            <InstalledOutgoingWebhook
                key={1}
                outgoingWebhook={outgoingWebhook}
                onRegenToken={emptyFunction}
                onDelete={emptyFunction}
                creator={{}}
                filter={'issu'}
                canChange={true}
                team={{
                    id: teamId,
                    name: 'test'
                }}
                channel={{
                    id: '1jiw9kphbjrntfyrm7xpdcya4o',
                    name: 'town-square'
                }}
            />
        );
        expect(wrapper.find('.item-details').exists()).toBe(true);
    });

    test('Should call onRegenToken', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function
        const onRegenToken = jest.fn();

        const wrapper = shallow(
            <InstalledOutgoingWebhook
                key={1}
                outgoingWebhook={outgoingWebhook}
                onRegenToken={onRegenToken}
                onDelete={emptyFunction}
                creator={{}}
                filter={'issu'}
                canChange={true}
                team={{
                    id: teamId,
                    name: 'test'
                }}
                channel={{
                    id: '1jiw9kphbjrntfyrm7xpdcya4o',
                    name: 'town-square'
                }}
            />
        );
        wrapper.find('div.item-actions a').first().simulate('click', {preventDefault() {
            return jest.fn();
        }});

        expect(onRegenToken).toBeCalled();
    });
});
