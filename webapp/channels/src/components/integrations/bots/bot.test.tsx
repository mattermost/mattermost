// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {generateId} from 'mattermost-redux/utils/helpers';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper as UtilsTestHelper} from 'utils/test_helper';

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
        renderWithContext(
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

        expect(screen.getByText(/\(@\)/)).toBeInTheDocument();
        expect(screen.getByText(/plugin/)).toBeInTheDocument();

        // if bot managed by plugin, remove ability to edit from UI
        expect(screen.queryByText('Create New Token')).not.toBeInTheDocument();
        expect(screen.queryByText('Edit')).not.toBeInTheDocument();
        expect(screen.queryByText(/^Disable$/)).not.toBeInTheDocument();
        expect(screen.queryByText(/^Enable$/)).not.toBeInTheDocument();
    });

    it('app bot', () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1'});
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        renderWithContext(
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

        expect(screen.getByText(/\(@\)/)).toBeInTheDocument();
        expect(screen.getByText(/Apps Framework/)).toBeInTheDocument();

        // if bot managed by app framework, ability to edit from UI is retained
        expect(screen.getByText('Create New Token')).toBeInTheDocument();
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('Disable')).toBeInTheDocument();
        expect(screen.queryByText(/^Enable$/)).not.toBeInTheDocument();
    });

    it('disabled bot', () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1'});
        bot.delete_at = 100; // disabled
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        renderWithContext(
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
        expect(screen.getByText(/\(@\)/)).toBeInTheDocument();
        expect(screen.getByText(/plugin/)).toBeInTheDocument();
        expect(screen.queryByText('Create New Token')).not.toBeInTheDocument();
        expect(screen.queryByText('Edit')).not.toBeInTheDocument();
        expect(screen.queryByText(/^Disable$/)).not.toBeInTheDocument();
        expect(screen.getByText('Enable')).toBeInTheDocument();
    });

    it('bot with owner', () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1', owner_id: '1'});
        const owner = UtilsTestHelper.getUserMock({id: bot.owner_id});
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        renderWithContext(
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
        expect(screen.getByText(new RegExp(owner.username))).toBeInTheDocument();
        expect(screen.queryByText(/plugin/)).not.toBeInTheDocument();

        // if bot is not managed by plugin, ability to edit from UI is retained
        expect(screen.getByText('Create New Token')).toBeInTheDocument();
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('Disable')).toBeInTheDocument();
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

        renderWithContext(
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

        expect(screen.getByText(tokenId)).toBeInTheDocument();
        expect(screen.getByText(/^Disable$/)).toBeInTheDocument();
        expect(screen.queryByText(/^Enable$/)).not.toBeInTheDocument();
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

        renderWithContext(
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

        expect(screen.getByText(tokenId)).toBeInTheDocument();
        expect(screen.queryByText(/^Disable$/)).not.toBeInTheDocument();
        expect(screen.getByText(/^Enable$/)).toBeInTheDocument();
    });
});
