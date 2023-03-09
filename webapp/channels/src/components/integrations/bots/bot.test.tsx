// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';
import {FormattedMessage} from 'react-intl';

import Markdown from 'components/markdown';
import {TestHelper as UtilsTestHelper} from 'utils/test_helper';
import {generateId} from 'mattermost-redux/utils/helpers';

import Bot from './bot';

describe('components/integrations/bots/Bot', () => {
    const team = UtilsTestHelper.getTeamMock();
    const actions = {
        disableBot: jest.fn(),
        enableBot: jest.fn(),
        createUserAccessToken: jest.fn(),
        revokeUserAccessToken: jest.fn(),
        enableUserAccessToken: jest.fn(),
        disableUserAccessToken: jest.fn(),
    };

    it('regular bot', () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1'});
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        const wrapper = shallow(
            <Bot
                bot={bot}
                user={user}
                owner={undefined}
                accessTokens={{}}
                team={team}
                actions={actions}
                fromApp={false}
            />,
        );

        expect(wrapper.contains(bot.display_name + ' (@' + bot.username + ')')).toEqual(true);
        expect(wrapper.contains(<Markdown message={bot.description}/>)).toEqual(true);
        expect(wrapper.contains('plugin')).toEqual(true);

        // if bot managed by plugin, remove ability to edit from UI
        expect(wrapper.contains(
            <FormattedMessage
                id='bot.manage.create_token'
                defaultMessage='Create New Token'
            />,
        )).toEqual(false);
        expect(wrapper.contains(
            <FormattedMessage
                id='bots.manage.edit'
                defaultMessage='Edit'
            />,
        )).toEqual(false);
        expect(wrapper.contains(
            <FormattedMessage
                id='bot.manage.disable'
                defaultMessage='Disable'
            />,
        )).toEqual(false);
        expect(wrapper.contains(
            <FormattedMessage
                id='bot.manage.enable'
                defaultMessage='Enable'
            />,
        )).toEqual(false);
    });

    it('app bot', () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1'});
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        const wrapper = shallow(
            <Bot
                bot={bot}
                user={user}
                owner={undefined}
                accessTokens={{}}
                team={team}
                actions={actions}
                fromApp={true}
            />,
        );

        expect(wrapper.contains(bot.display_name + ' (@' + bot.username + ')')).toEqual(true);
        expect(wrapper.contains(<Markdown message={bot.description}/>)).toEqual(true);
        expect(wrapper.contains('Apps Framework')).toEqual(true);

        // if bot managed by plugin, remove ability to edit from UI
        expect(wrapper.contains(
            <FormattedMessage
                id='bot.manage.create_token'
                defaultMessage='Create New Token'
            />,
        )).toEqual(true);
        expect(wrapper.contains(
            <FormattedMessage
                id='bots.manage.edit'
                defaultMessage='Edit'
            />,
        )).toEqual(true);
        expect(wrapper.contains(
            <FormattedMessage
                id='bot.manage.disable'
                defaultMessage='Disable'
            />,
        )).toEqual(true);
        expect(wrapper.contains(
            <FormattedMessage
                id='bot.manage.enable'
                defaultMessage='Enable'
            />,
        )).toEqual(false);
    });

    it('disabled bot', () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1'});
        bot.delete_at = 100; // disabled
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        const wrapper = shallow(
            <Bot
                bot={bot}
                user={user}
                owner={undefined}
                accessTokens={{}}
                team={team}
                actions={actions}
                fromApp={false}
            />,
        );
        expect(wrapper.contains(bot.display_name + ' (@' + bot.username + ')')).toEqual(true);
        expect(wrapper.contains(<Markdown message={bot.description}/>)).toEqual(true);
        expect(wrapper.contains('plugin')).toEqual(true);
        expect(wrapper.contains(
            <FormattedMessage
                id='bot.manage.create_token'
                defaultMessage='Create New Token'
            />,
        )).toEqual(false);
        expect(wrapper.contains(
            <FormattedMessage
                id='bots.manage.edit'
                defaultMessage='Edit'
            />,
        )).toEqual(false);
        expect(wrapper.contains(
            <FormattedMessage
                id='bot.manage.disable'
                defaultMessage='Disable'
            />,
        )).toEqual(false);
        expect(wrapper.contains(
            <FormattedMessage
                id='bot.manage.enable'
                defaultMessage='Enable'
            />,
        )).toEqual(true);
    });

    it('bot with owner', () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1', owner_id: '1'});
        const owner = UtilsTestHelper.getUserMock({id: bot.owner_id});
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        const wrapper = shallow(
            <Bot
                bot={bot}
                owner={owner}
                user={user}
                accessTokens={{}}
                team={team}
                actions={actions}
                fromApp={false}
            />,
        );
        expect(wrapper.contains(owner.username)).toEqual(true);
        expect(wrapper.contains('plugin')).toEqual(false);

        // if bot is not managed by plugin, ability to edit from UI is retained
        expect(wrapper.contains(
            <FormattedMessage
                id='bot.manage.create_token'
                defaultMessage='Create New Token'
            />,
        )).toEqual(true);
        expect(wrapper.contains(
            <FormattedMessage
                id='bots.manage.edit'
                defaultMessage='Edit'
            />,
        )).toEqual(true);
        expect(wrapper.contains(
            <FormattedMessage
                id='bot.manage.disable'
                defaultMessage='Disable'
            />,
        )).toEqual(true);
    });

    it('bot with access tokens', () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1'});
        const tokenId = generateId();
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        const accessTokens = {
            tokenId: UtilsTestHelper.getUserAccessTokenMock({
                id: tokenId,
                user_id: bot.user_id,
            }),
        };

        const wrapper = shallow(
            <Bot
                bot={bot}
                owner={undefined}
                user={user}
                accessTokens={accessTokens}
                team={team}
                actions={actions}
                fromApp={false}
            />,
        );

        expect(wrapper.contains(tokenId)).toEqual(true);
        expect(wrapper.contains(
            <FormattedMessage
                id='user.settings.tokens.deactivate'
                defaultMessage='Disable'
            />,
        )).toEqual(true);
        expect(wrapper.contains(
            <FormattedMessage
                id='user.settings.tokens.activate'
                defaultMessage='Enable'
            />,
        )).toEqual(false);
    });

    it('bot with disabled access tokens', () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1'});
        const tokenId = generateId();
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});

        const accessTokens = {
            tokenId: UtilsTestHelper.getUserAccessTokenMock({
                id: tokenId,
                user_id: bot.user_id,
                is_active: false,
            }),
        };

        const wrapper = shallow(
            <Bot
                bot={bot}
                owner={undefined}
                user={user}
                accessTokens={accessTokens}
                team={team}
                actions={actions}
                fromApp={false}
            />,
        );

        expect(wrapper.contains(tokenId)).toEqual(true);
        expect(wrapper.contains(
            <FormattedMessage
                id='user.settings.tokens.deactivate'
                defaultMessage='Disable'
            />,
        )).toEqual(false);
        expect(wrapper.contains(
            <FormattedMessage
                id='user.settings.tokens.activate'
                defaultMessage='Enable'
            />,
        )).toEqual(true);
    });
});
