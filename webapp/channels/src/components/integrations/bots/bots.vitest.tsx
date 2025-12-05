// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, act} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import Bots from './bots';

describe('components/integrations/bots/Bots', () => {
    const team = TestHelper.getTeamMock();

    it('bots', async () => {
        const bot1 = TestHelper.getBotMock({user_id: '1', username: 'bot1', display_name: 'Bot 1'});
        const bot2 = TestHelper.getBotMock({user_id: '2', username: 'bot2', display_name: 'Bot 2'});
        const bot3 = TestHelper.getBotMock({user_id: '3', username: 'bot3', display_name: 'Bot 3'});
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

        const actions = {
            loadBots: vi.fn().mockResolvedValue({data: [bot1, bot2, bot3]}),
            getUserAccessTokensForUser: vi.fn().mockResolvedValue({}),
            createUserAccessToken: vi.fn(),
            revokeUserAccessToken: vi.fn(),
            enableUserAccessToken: vi.fn(),
            disableUserAccessToken: vi.fn(),
            getUser: vi.fn().mockResolvedValue({}),
            disableBot: vi.fn(),
            enableBot: vi.fn(),
            fetchAppsBotIDs: vi.fn(),
        };

        await act(async () => {
            renderWithContext(
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
        });

        // Wait for loading to complete
        await vi.waitFor(() => {
            expect(screen.queryByText('Loading')).not.toBeInTheDocument();
        });

        // All bots should be displayed
        expect(screen.getByText('Bot 1 (@bot1)')).toBeInTheDocument();
        expect(screen.getByText('Bot 2 (@bot2)')).toBeInTheDocument();
        expect(screen.getByText('Bot 3 (@bot3)')).toBeInTheDocument();
    });

    it('bots with bots from apps', async () => {
        const bot1 = TestHelper.getBotMock({user_id: '1', username: 'bot1', display_name: 'Bot 1'});
        const bot2 = TestHelper.getBotMock({user_id: '2', username: 'bot2', display_name: 'Bot 2'});
        const bot3 = TestHelper.getBotMock({user_id: '3', username: 'appbot', display_name: 'App Bot'});
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

        const actions = {
            loadBots: vi.fn().mockResolvedValue({data: [bot1, bot2, bot3]}),
            getUserAccessTokensForUser: vi.fn().mockResolvedValue({}),
            createUserAccessToken: vi.fn(),
            revokeUserAccessToken: vi.fn(),
            enableUserAccessToken: vi.fn(),
            disableUserAccessToken: vi.fn(),
            getUser: vi.fn().mockResolvedValue({}),
            disableBot: vi.fn(),
            enableBot: vi.fn(),
            fetchAppsBotIDs: vi.fn(),
        };

        await act(async () => {
            renderWithContext(
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
        });

        // Wait for loading to complete
        await vi.waitFor(() => {
            expect(screen.queryByText('Loading')).not.toBeInTheDocument();
        });

        // All bots should be displayed
        expect(screen.getByText('Bot 1 (@bot1)')).toBeInTheDocument();
        expect(screen.getByText('Bot 2 (@bot2)')).toBeInTheDocument();
        expect(screen.getByText('App Bot (@appbot)')).toBeInTheDocument();
    });

    it('bot owner tokens', async () => {
        const bot1 = TestHelper.getBotMock({user_id: '1', owner_id: '2', username: 'ownedbot', display_name: 'Owned Bot'});
        const bots = {
            [bot1.user_id]: bot1,
        };

        const owner = TestHelper.getUserMock({id: '2', username: 'botowner'});

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

        const actions = {
            loadBots: vi.fn().mockResolvedValue({data: [bot1]}),
            getUserAccessTokensForUser: vi.fn().mockResolvedValue({}),
            createUserAccessToken: vi.fn(),
            revokeUserAccessToken: vi.fn(),
            enableUserAccessToken: vi.fn(),
            disableUserAccessToken: vi.fn(),
            getUser: vi.fn().mockResolvedValue({}),
            disableBot: vi.fn(),
            enableBot: vi.fn(),
            fetchAppsBotIDs: vi.fn(),
        };

        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
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
            container = result.container;
        });

        // Wait for loading to complete
        await vi.waitFor(() => {
            expect(screen.queryByText('Loading')).not.toBeInTheDocument();
        });

        // Bot should be displayed with owner
        expect(screen.getByText('Owned Bot (@ownedbot)')).toBeInTheDocument();
        expect(container!).toMatchSnapshot();
    });
});
