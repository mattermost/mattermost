// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {TestHelper} from 'utils/test_helper';

import Bots from './bots';
import BotsList from './bots_list';

describe('components/integrations/bots/Bots', () => {
    const team = TestHelper.getTeamMock();
    const actions = {
        loadBots: jest.fn().mockReturnValue(Promise.resolve({})),
        getUserAccessTokensForUser: jest.fn(),
        createUserAccessToken: jest.fn(),
        revokeUserAccessToken: jest.fn(),
        enableUserAccessToken: jest.fn(),
        disableUserAccessToken: jest.fn(),
        getUser: jest.fn(),
        disableBot: jest.fn(),
        enableBot: jest.fn(),
        fetchAppsBotIDs: jest.fn(),
    };

    it('renders BotsList with correct props', () => {
        const bot1 = TestHelper.getBotMock({user_id: '1'});
        const bot2 = TestHelper.getBotMock({user_id: '2'});
        const bot3 = TestHelper.getBotMock({user_id: '3'});
        const bots = {
            [bot1.user_id]: bot1,
            [bot2.user_id]: bot2,
            [bot3.user_id]: bot3,
        };
        const users = {
            [bot1.user_id]: TestHelper.getUserMock({id: bot1.user_id}),
            [bot2.user_id]: TestHelper.getUserMock({id: bot2.user_id}),
            [bot3.user_id]: TestHelper.getUserMock({id: bot3.user_id}),
        };

        const wrapper = shallow(
            <Bots
                bots={bots}
                team={team}
                accessTokens={{}}
                owners={{}}
                users={users}
                actions={actions}
                appsEnabled={false}
                appsBotIDs={[]}
            />,
        );

        expect(wrapper.find(BotsList)).toHaveLength(1);
        expect(wrapper.find(BotsList).prop('bots')).toHaveLength(3);
    });

    it('bots with bots from apps', () => {
        const bot1 = TestHelper.getBotMock({user_id: '1'});
        const bot2 = TestHelper.getBotMock({user_id: '2'});
        const bot3 = TestHelper.getBotMock({user_id: '3'});
        const bots = {
            [bot1.user_id]: bot1,
            [bot2.user_id]: bot2,
            [bot3.user_id]: bot3,
        };
        const users = {
            [bot1.user_id]: TestHelper.getUserMock({id: bot1.user_id}),
            [bot2.user_id]: TestHelper.getUserMock({id: bot2.user_id}),
            [bot3.user_id]: TestHelper.getUserMock({id: bot3.user_id}),
        };

        const wrapper = shallow(
            <Bots
                bots={bots}
                team={team}
                accessTokens={{}}
                owners={{}}
                users={users}
                actions={actions}
                appsEnabled={true}
                appsBotIDs={[bot3.user_id]}
            />,
        );

        expect(wrapper.find(BotsList)).toHaveLength(1);
        expect(wrapper.find(BotsList).prop('appsBotIDs')).toContain(bot3.user_id);
    });

    it('bot owner tokens', () => {
        const bot1 = TestHelper.getBotMock({user_id: '1', owner_id: '1'});
        const bots = {
            [bot1.user_id]: bot1,
        };

        const owner = TestHelper.getUserMock({id: bot1.owner_id});
        const user = TestHelper.getUserMock({id: bot1.user_id});

        const passedTokens = {
            id: TestHelper.getUserAccessTokenMock(),
        };

        const owners = {
            [bot1.user_id]: owner,
        };

        const users = {
            [bot1.user_id]: user,
        };

        const tokens = {
            [bot1.user_id]: passedTokens,
        };

        const wrapper = shallow(
            <Bots
                bots={bots}
                team={team}
                accessTokens={tokens}
                owners={owners}
                users={users}
                actions={actions}
                appsEnabled={false}
                appsBotIDs={[]}
            />,
        );

        expect(wrapper.find(BotsList)).toHaveLength(1);
        expect(wrapper.find(BotsList).prop('accessTokens')).toEqual(tokens);
    });
});
