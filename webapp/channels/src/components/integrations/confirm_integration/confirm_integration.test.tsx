// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Router} from 'react-router-dom';

import {shallow} from 'enzyme';

import type {Bot} from '@mattermost/types/bots';
import type {IncomingWebhook, OAuthApp, OutgoingWebhook} from '@mattermost/types/integrations';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import ConfirmIntegration from 'components/integrations/confirm_integration/confirm_integration';

import {renderWithIntlAndStore} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {TestHelper} from 'utils/test_helper';

describe('components/integrations/ConfirmIntegration', () => {
    const id = 'r5tpgt4iepf45jt768jz84djic';
    const token = 'jb6oyqh95irpbx8fo9zmndkp1r';
    const getSearchString = (type: string, identifier = id) => `?type=${type}&id=${identifier}`;

    const initialState = {
        entities: {
            general: {
                config: {},
                license: {
                    Cloud: 'false',
                },
            },
            users: {
                currentUserId: 'currentUserId',
            },
        },
    };

    const location = {
        search: '',
    };
    const team = TestHelper.getTeamMock({
        name: 'team_test',
    });
    const oauthApp = {
        id,
        client_secret: '<==secret==>',
        callback_urls: ['https://someCallback', 'https://anotherCallback'],
    };
    const userId = 'b5tpgt4iepf45jt768jz84djhd';
    const bot = TestHelper.getBotMock({
        user_id: userId,
        display_name: 'bot',
    });
    const commands = {[id]: TestHelper.getCommandMock({id, token})};
    const oauthApps = {[id]: oauthApp} as unknown as IDMappedObjects<OAuthApp>;
    const incomingHooks: IDMappedObjects<IncomingWebhook> = {[id]: TestHelper.getIncomingWebhookMock({id})};
    const outgoingHooks = {[id]: {id, token}} as unknown as IDMappedObjects<OutgoingWebhook>;
    const bots: Record<string, Bot> = {[userId]: bot};

    const props = {
        team,
        location,
        commands,
        oauthApps,
        incomingHooks,
        outgoingHooks,
        bots,
    };

    test('should match snapshot, oauthApps case', () => {
        props.location.search = getSearchString('oauth2-apps');
        const wrapper = shallow(
            <ConfirmIntegration {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match callback URLs of OAuth Apps', () => {
        props.location.search = getSearchString('oauth2-apps');
        const {container} = renderWithIntlAndStore(
            <Router history={getHistory()}>
                <ConfirmIntegration {...props}/>
            </Router>,
            initialState,
        );

        expect(container.querySelector('.word-break--all')).toHaveTextContent('URL(s): https://someCallback, https://anotherCallback');
    });

    test('should match snapshot, commands case', () => {
        props.location.search = getSearchString('commands');
        const wrapper = shallow(
            <ConfirmIntegration {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, incomingHooks case', () => {
        props.location.search = getSearchString('incoming_webhooks');
        const wrapper = shallow(
            <ConfirmIntegration {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, outgoingHooks case', () => {
        props.location.search = getSearchString('outgoing_webhooks');
        const wrapper = shallow(
            <ConfirmIntegration {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, outgoingHooks and bad identifier case', () => {
        props.location.search = getSearchString('outgoing_webhooks', 'bad');
        const wrapper = shallow(
            <ConfirmIntegration {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, bad integration type case', () => {
        props.location.search = getSearchString('bad');
        const wrapper = shallow(
            <ConfirmIntegration {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
