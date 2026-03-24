// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import Bots from './bots';

describe('components/integrations/bots/Bots', () => {
    const team = TestHelper.getTeamMock();
    const actions = {
        loadBots: jest.fn().mockReturnValue(Promise.resolve({data: []})),
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

    it('bots', async () => {
        const bot1 = TestHelper.getBotMock({user_id: '1', username: 'bot1', display_name: 'Bot 1', delete_at: 0});
        const bot2 = TestHelper.getBotMock({user_id: '2', username: 'bot2', display_name: 'Bot 2', delete_at: 0});
        const bot3 = TestHelper.getBotMock({user_id: '3', username: 'bot3', display_name: 'Bot 3', delete_at: 0});
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

        const loadBots = jest.fn().mockReturnValue(Promise.resolve({data: Object.values(bots)}));

        // BackstageList passes filterLowered as a DOM prop which triggers a React warning
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const {container} = renderWithContext(
            <Bots
                bots={bots}
                team={team}
                accessTokens={{}}
                owners={{}}
                users={users}
                actions={{...actions, loadBots}}
                appsEnabled={false}
                appsBotIDs={[]}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText(/Bot 1 \(@bot1\)/)).toBeInTheDocument();
            expect(screen.getByText(/Bot 2 \(@bot2\)/)).toBeInTheDocument();
            expect(screen.getByText(/Bot 3 \(@bot3\)/)).toBeInTheDocument();
        });

        // All should show plugin as managed-by since no owner
        const managedByDivs = container.querySelectorAll('.light.small');
        expect(managedByDivs.length).toBe(3);
        managedByDivs.forEach((div) => {
            expect(div.textContent).toContain('plugin');
        });

        spy.mockRestore();
    });

    it('bots with bots from apps', async () => {
        const bot1 = TestHelper.getBotMock({user_id: '1', username: 'bot1', display_name: 'Bot 1', delete_at: 0});
        const bot2 = TestHelper.getBotMock({user_id: '2', username: 'bot2', display_name: 'Bot 2', delete_at: 0});
        const bot3 = TestHelper.getBotMock({user_id: '3', username: 'bot3', display_name: 'Bot 3', delete_at: 0});
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

        const loadBots = jest.fn().mockReturnValue(Promise.resolve({data: Object.values(bots)}));

        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const {container} = renderWithContext(
            <Bots
                bots={bots}
                team={team}
                accessTokens={{}}
                owners={{}}
                users={users}
                actions={{...actions, loadBots}}
                appsEnabled={true}
                appsBotIDs={[bot3.user_id]}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText(/Bot 1 \(@bot1\)/)).toBeInTheDocument();
            expect(screen.getByText(/Bot 2 \(@bot2\)/)).toBeInTheDocument();
            expect(screen.getByText(/Bot 3 \(@bot3\)/)).toBeInTheDocument();
        });

        // Check managed-by for each bot via DOM
        const managedByDivs = container.querySelectorAll('.light.small');
        expect(managedByDivs.length).toBe(3);

        const managedByTexts = Array.from(managedByDivs).map((div) => div.textContent);
        expect(managedByTexts.filter((t) => t?.includes('Apps Framework')).length).toBe(1);
        expect(managedByTexts.filter((t) => t?.includes('plugin')).length).toBe(2);

        spy.mockRestore();
    });

    it('bot owner tokens', async () => {
        const bot1 = TestHelper.getBotMock({user_id: '1', owner_id: '1', username: 'bot1', display_name: 'Bot 1', delete_at: 0});
        const bots = {
            [bot1.user_id]: bot1,
        };

        const owner = TestHelper.getUserMock({id: bot1.owner_id, username: 'owner1'});

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

        const loadBots = jest.fn().mockReturnValue(Promise.resolve({data: Object.values(bots)}));

        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const {container} = renderWithContext(
            <Bots
                bots={bots}
                team={team}
                accessTokens={tokens}
                owners={owners}
                users={users}
                actions={{...actions, loadBots}}
                appsEnabled={false}
                appsBotIDs={[]}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText(/Bot 1 \(@bot1\)/)).toBeInTheDocument();
        });

        // Owner username should be shown in managed-by section
        const managedByDiv = container.querySelector('.light.small');
        expect(managedByDiv).toBeInTheDocument();
        expect(managedByDiv!.textContent).toContain('owner1');

        spy.mockRestore();
    });
});
