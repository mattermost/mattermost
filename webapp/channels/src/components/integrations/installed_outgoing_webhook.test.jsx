// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';
import {Link} from 'react-router-dom';

import DeleteIntegrationLink from 'components/integrations/delete_integration_link';
import InstalledOutgoingWebhook, {matchesFilter} from 'components/integrations/installed_outgoing_webhook';

describe('components/integrations/InstalledOutgoingWebhook', () => {
    const team = {
        id: 'testteamid',
        name: 'test',
    };
    const channel = {
        id: '1jiw9kphbjrntfyrm7xpdcya4o',
        name: 'town-square',
        display_name: 'Town Square',
    };
    const outgoingWebhook = {
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
        0: 'asdf',
        update_at: 1508329149618,
    };

    const baseProps = {
        outgoingWebhook,
        onRegenToken: () => {}, //eslint-disable-line no-empty-function
        onDelete: () => {}, //eslint-disable-line no-empty-function
        filter: '',
        creator: {username: 'username'},
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
        const newOutgoingWebhook = {...outgoingWebhook, description: null};
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

        // displays webhook's display name
        expect(wrapper.instance().makeDisplayName({display_name: 'hook display name'}, {})).toMatchSnapshot();

        // displays channel's display name
        expect(wrapper.instance().makeDisplayName({}, {display_name: 'channel display name'})).toMatchSnapshot();

        // displays a private hook
        expect(wrapper.instance().makeDisplayName({})).toMatchSnapshot();
    });

    test('Should match result when matchesFilter is called', () => {
        expect(matchesFilter({}, {}, 'word')).toEqual(false);
        expect(matchesFilter({display_name: null}, {}, 'word')).toEqual(false);
        expect(matchesFilter({description: null}, {}, 'word')).toEqual(false);
        expect(matchesFilter({trigger_words: null}, {}, 'word')).toEqual(false);
        expect(matchesFilter({}, {name: null}, 'channel')).toEqual(false);

        expect(matchesFilter({}, {}, '')).toEqual(true);

        expect(matchesFilter({display_name: 'Word'}, {}, 'word')).toEqual(true);
        expect(matchesFilter({display_name: 'word'}, {}, 'word')).toEqual(true);
        expect(matchesFilter({description: 'Trigger description'}, {}, 'description')).toEqual(true);

        expect(matchesFilter({trigger_words: ['Trigger']}, {}, 'trigger')).toEqual(true);
        expect(matchesFilter({trigger_words: ['word', 'Trigger']}, {}, 'trigger')).toEqual(true);

        expect(matchesFilter({}, {name: 'channel_name'}, 'channel')).toEqual(true);
    });
});
