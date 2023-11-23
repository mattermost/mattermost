// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {TestHelper} from 'utils/test_helper';

import Bot from './bot';
import Bots from './bots';

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

    it('bots', () => {
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

        const wrapperFull = shallow(
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
        wrapperFull.instance().setState({loading: false});
        const wrapper = shallow(<div>{(wrapperFull.instance() as Bots).bots()[0]}</div>);

        expect(wrapper.find('EnabledSection').shallow().contains(
            <Bot
                key={bot1.user_id}
                bot={bot1}
                owner={undefined}
                user={users[bot1.user_id]}
                accessTokens={{}}
                team={team}
                actions={actions}
                fromApp={false}
            />,
        )).toEqual(true);
        expect(wrapper.find('EnabledSection').shallow().contains(
            <Bot
                key={bot2.user_id}
                bot={bot2}
                owner={undefined}
                user={users[bot2.user_id]}
                accessTokens={{}}
                team={team}
                actions={actions}
                fromApp={false}
            />,
        )).toEqual(true);
        expect(wrapper.find('EnabledSection').shallow().contains(
            <Bot
                key={bot3.user_id}
                bot={bot3}
                owner={undefined}
                user={users[bot3.user_id]}
                accessTokens={{}}
                team={team}
                actions={actions}
                fromApp={false}
            />,
        )).toEqual(true);
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

        const wrapperFull = shallow(
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
        wrapperFull.instance().setState({loading: false});
        const wrapper = shallow(<div>{(wrapperFull.instance() as Bots).bots()[0]}</div>);

        expect(wrapper.find('EnabledSection').shallow().contains(
            <Bot
                key={bot1.user_id}
                bot={bot1}
                owner={undefined}
                user={users[bot1.user_id]}
                accessTokens={{}}
                team={team}
                actions={actions}
                fromApp={false}
            />,
        )).toEqual(true);
        expect(wrapper.find('EnabledSection').shallow().contains(
            <Bot
                key={bot2.user_id}
                bot={bot2}
                owner={undefined}
                user={users[bot2.user_id]}
                accessTokens={{}}
                team={team}
                actions={actions}
                fromApp={false}
            />,
        )).toEqual(true);
        expect(wrapper.find('EnabledSection').shallow().contains(
            <Bot
                key={bot3.user_id}
                bot={bot3}
                owner={undefined}
                user={users[bot3.user_id]}
                accessTokens={{}}
                team={team}
                actions={actions}
                fromApp={true}
            />,
        )).toEqual(true);
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

        const wrapperFull = shallow(
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
        wrapperFull.instance().setState({loading: false});
        const wrapper = shallow(<div>{(wrapperFull.instance() as Bots).bots()[0]}</div>);

        expect(wrapper.find('EnabledSection').shallow().contains(
            <Bot
                key={bot1.user_id}
                bot={bot1}
                owner={owner}
                user={user}
                accessTokens={passedTokens}
                team={team}
                actions={actions}
                fromApp={false}
            />,
        )).toEqual(true);
    });
});
