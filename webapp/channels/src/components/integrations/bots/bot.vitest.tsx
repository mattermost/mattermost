// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {generateId} from 'mattermost-redux/utils/helpers';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {TestHelper as UtilsTestHelper} from 'utils/test_helper';

import Bot from './bot';

describe('components/integrations/bots/Bot', () => {
    const team = UtilsTestHelper.getTeamMock();
    const actions = {
        disableBot: vi.fn(),
        enableBot: vi.fn(),
        createUserAccessToken: vi.fn(),
        revokeUserAccessToken: vi.fn(),
        enableUserAccessToken: vi.fn(),
        disableUserAccessToken: vi.fn(),
    };

    it('regular bot', () => {
        const bot = UtilsTestHelper.getBotMock({
            user_id: '1',
            username: 'testbot',
            display_name: 'Test Bot',
            description: 'A test bot description',
        });
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        const {container} = renderWithContext(
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

        expect(screen.getByText('Test Bot (@testbot)')).toBeInTheDocument();
        expect(screen.getByText('A test bot description')).toBeInTheDocument();

        // if bot managed by plugin, remove ability to edit from UI
        expect(screen.queryByText('Create New Token')).not.toBeInTheDocument();
        expect(screen.queryByText('Edit')).not.toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it('app bot', () => {
        const bot = UtilsTestHelper.getBotMock({
            user_id: '1',
            username: 'appbot',
            display_name: 'App Bot',
            description: 'An app bot description',
        });
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        const {container} = renderWithContext(
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

        expect(screen.getByText('App Bot (@appbot)')).toBeInTheDocument();
        expect(screen.getByText('An app bot description')).toBeInTheDocument();

        // if bot managed by app, ability to edit from UI is retained
        expect(screen.getByText('Create New Token')).toBeInTheDocument();
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('Disable')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it('disabled bot', () => {
        const bot = UtilsTestHelper.getBotMock({
            user_id: '1',
            username: 'disabledbot',
            display_name: 'Disabled Bot',
            description: 'A disabled bot description',
            delete_at: 100,
        });
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        const {container} = renderWithContext(
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
        expect(screen.getByText('Disabled Bot (@disabledbot)')).toBeInTheDocument();
        expect(screen.getByText('A disabled bot description')).toBeInTheDocument();
        expect(screen.queryByText('Create New Token')).not.toBeInTheDocument();
        expect(screen.queryByText('Edit')).not.toBeInTheDocument();
        expect(screen.queryByText('Disable')).not.toBeInTheDocument();
        expect(screen.getByText('Enable')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it('bot with owner', () => {
        const bot = UtilsTestHelper.getBotMock({
            user_id: '1',
            owner_id: '2',
            username: 'ownedbot',
            display_name: 'Owned Bot',
            description: 'A bot with an owner',
        });
        const owner = UtilsTestHelper.getUserMock({id: '2', username: 'botowner'});
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        const {container} = renderWithContext(
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

        // if bot is not managed by plugin, ability to edit from UI is retained
        expect(screen.getByText('Create New Token')).toBeInTheDocument();
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('Disable')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
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

        // Token is active, so it shows Disable
        const disableButtons = screen.getAllByText('Disable');
        expect(disableButtons.length).toBeGreaterThan(0);
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

        // Token is disabled, so it shows Enable for the token
        const enableButtons = screen.getAllByText('Enable');
        expect(enableButtons.length).toBeGreaterThan(0);
    });
});
