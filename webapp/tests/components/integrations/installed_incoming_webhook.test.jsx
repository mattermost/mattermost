// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';
import {Link} from 'react-router';
import DeleteIntegration from 'components/integrations/components/delete_integration.jsx';
import InstalledIncomingWebhook from 'components/integrations/components/installed_incoming_webhook.jsx';

describe('components/integrations/InstalledIncomingWebhook', () => {
    let incomingWebhook = {};
    const teamId = 'testteamid';
    beforeEach(() => {
        incomingWebhook = {
            channel_id: '1jiw9kphbjrntfyrm7xpdcya4o',
            create_at: 1502455422406,
            delete_at: 0,
            description: 'build status',
            display_name: 'build',
            id: '9w96t4nhbfdiij64wfqors4i1r',
            team_id: 'eatxocwc3bg9ffo9xyybnj4omr',
            update_at: 1502455422406,
            user_id: 'zaktnt8bpbgu8mb6ez9k64r7sa'
        };
    });

    test('should match snapshot', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const wrapper = shallow(
            <InstalledIncomingWebhook
                key={1}
                incomingWebhook={incomingWebhook}
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

    test('should not have edit and delete actions if user does not have permissions to change', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const wrapper = shallow(
            <InstalledIncomingWebhook
                key={1}
                incomingWebhook={incomingWebhook}
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
            <InstalledIncomingWebhook
                key={1}
                incomingWebhook={incomingWebhook}
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
        expect(wrapper.find('.item-actions').find(Link).exists()).toBe(true);
        expect(wrapper.find('.item-actions').find(DeleteIntegration).exists()).toBe(true);
    });

    test('Should have the same name and description on view as it has in incomingWebhook', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const wrapper = shallow(
            <InstalledIncomingWebhook
                key={1}
                incomingWebhook={incomingWebhook}
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

        expect(wrapper.find('.item-details__description').text()).toBe('build status');
        expect(wrapper.find('.item-details__name').text()).toBe('build');
    });

    test('Should not display description as it is null', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function
        incomingWebhook.description = null;
        const wrapper = shallow(
            <InstalledIncomingWebhook
                key={1}
                incomingWebhook={incomingWebhook}
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
            <InstalledIncomingWebhook
                key={1}
                incomingWebhook={incomingWebhook}
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
            <InstalledIncomingWebhook
                key={1}
                incomingWebhook={incomingWebhook}
                onDelete={emptyFunction}
                creator={{}}
                filter={'buil'}
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
});
