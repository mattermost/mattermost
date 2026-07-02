// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Bot} from '@mattermost/types/bots';

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

    function createBotsAndUsers(count: number) {
        const bots: Record<string, Bot> = {};
        const users: Record<string, ReturnType<typeof TestHelper.getUserMock>> = {};
        const botList: Bot[] = [];
        for (let i = 1; i <= count; i++) {
            const bot = TestHelper.getBotMock({user_id: String(i), username: `bot${i}`, display_name: `Bot ${i}`, delete_at: 0});
            bots[bot.user_id] = bot;
            users[bot.user_id] = TestHelper.getUserMock({id: bot.user_id});
            botList.push(bot);
        }
        const loadBots = jest.fn().mockReturnValue(Promise.resolve({data: botList}));
        return {bots, users, loadBots};
    }

    // BackstageList passes filterLowered as a DOM prop which triggers a React warning
    let consoleErrorSpy: jest.SpyInstance;
    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('bots', async () => {
        const {bots, users, loadBots} = createBotsAndUsers(3);

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
    });

    it('bots with bots from apps', async () => {
        const {bots, users, loadBots} = createBotsAndUsers(3);

        const {container} = renderWithContext(
            <Bots
                bots={bots}
                team={team}
                accessTokens={{}}
                owners={{}}
                users={users}
                actions={{...actions, loadBots}}
                appsEnabled={true}
                appsBotIDs={['3']}
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
    });

    it('paginates until a short page and processes bots beyond the first page', async () => {
        // A full first page forces the component to request the next page.
        const firstPage: Bot[] = [];
        const allBots: Record<string, Bot> = {};
        const allUsers: Record<string, ReturnType<typeof TestHelper.getUserMock>> = {};
        for (let i = 1; i <= 200; i++) {
            const bot = TestHelper.getBotMock({user_id: String(i), username: `bot${i}`, display_name: `Bot ${i}`, delete_at: 0});
            firstPage.push(bot);
            allBots[bot.user_id] = bot;
            allUsers[bot.user_id] = TestHelper.getUserMock({id: bot.user_id});
        }

        const newestBot = TestHelper.getBotMock({user_id: '201', username: 'irisnewbot', display_name: 'Iris Newest Bot', delete_at: 0});
        allBots[newestBot.user_id] = newestBot;
        allUsers[newestBot.user_id] = TestHelper.getUserMock({id: newestBot.user_id});

        const loadBots = jest.fn((page?: number) => {
            if (page === 0) {
                return Promise.resolve({data: firstPage});
            }
            if (page === 1) {
                return Promise.resolve({data: [newestBot]});
            }
            return Promise.resolve({data: []});
        });
        const getUser = jest.fn();

        renderWithContext(
            <Bots
                bots={allBots}
                team={team}
                accessTokens={{}}
                owners={{}}
                users={allUsers}
                actions={{...actions, loadBots, getUser}}
                appsEnabled={false}
                appsBotIDs={[]}
            />,
        );

        // The newest bot lives on the second page and is rendered once loading completes.
        await waitFor(() => {
            expect(screen.getByText(/Iris Newest Bot \(@irisnewbot\)/)).toBeInTheDocument();
        });

        // Successive pages are requested with the server's max page size until a short page is returned.
        expect(loadBots).toHaveBeenCalledWith(0, 200);
        expect(loadBots).toHaveBeenCalledWith(1, 200);
        expect(loadBots).toHaveBeenCalledTimes(2);

        // The second-page bot was accumulated and had its user details fetched.
        expect(getUser).toHaveBeenCalledWith(newestBot.user_id);
    });

    it('requests one more page when the final data page is exactly full', async () => {
        const makeFullPage = (start: number): Bot[] => {
            const page: Bot[] = [];
            for (let i = start; i < start + 200; i++) {
                page.push(TestHelper.getBotMock({user_id: String(i), username: `bot${i}`, delete_at: 0}));
            }
            return page;
        };

        // Both data pages are exactly full, so termination requires a trailing empty page.
        const secondPage = makeFullPage(200);
        const lastBot = TestHelper.getBotMock({user_id: '400', username: 'bot400', delete_at: 0});
        secondPage[secondPage.length - 1] = lastBot;

        const loadBots = jest.fn((page?: number) => {
            if (page === 0) {
                return Promise.resolve({data: makeFullPage(0)});
            }
            if (page === 1) {
                return Promise.resolve({data: secondPage});
            }
            return Promise.resolve({data: []});
        });
        const getUser = jest.fn();

        renderWithContext(
            <Bots
                bots={{}}
                team={team}
                accessTokens={{}}
                owners={{}}
                users={{}}
                actions={{...actions, loadBots, getUser}}
                appsEnabled={false}
                appsBotIDs={[]}
            />,
        );

        await waitFor(() => expect(loadBots).toHaveBeenCalledTimes(3));
        expect(loadBots).toHaveBeenNthCalledWith(1, 0, 200);
        expect(loadBots).toHaveBeenNthCalledWith(2, 1, 200);
        expect(loadBots).toHaveBeenNthCalledWith(3, 2, 200);
        expect(getUser).toHaveBeenCalledWith('400');
    });

    it('surfaces an error and completes loading when the first page fetch fails', async () => {
        const loadBots = jest.fn(() => Promise.resolve({error: {message: 'Failed to load bots'}}));
        const getUser = jest.fn();

        renderWithContext(
            <Bots
                bots={{}}
                team={team}
                accessTokens={{}}
                owners={{}}
                users={{}}
                actions={{...actions, loadBots, getUser}}
                appsEnabled={false}
                appsBotIDs={[]}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Bot accounts could not be loaded. Refresh the page to try again.')).toBeInTheDocument();
        });
        expect(screen.getByText('No bot accounts found')).toBeInTheDocument();
        expect(loadBots).toHaveBeenCalledTimes(1);
        expect(loadBots).toHaveBeenCalledWith(0, 200);
        expect(getUser).not.toHaveBeenCalled();
    });

    it('surfaces an incomplete-list warning and shows loaded bots when a later page fetch fails', async () => {
        const firstPage: Bot[] = [];
        const allBots: Record<string, Bot> = {};
        const allUsers: Record<string, ReturnType<typeof TestHelper.getUserMock>> = {};
        for (let i = 1; i <= 200; i++) {
            const bot = TestHelper.getBotMock({user_id: String(i), username: `bot${i}`, display_name: `Bot ${i}`, delete_at: 0});
            firstPage.push(bot);
            allBots[bot.user_id] = bot;
            allUsers[bot.user_id] = TestHelper.getUserMock({id: bot.user_id});
        }

        // First page loads fully, but the second page fetch fails.
        const loadBots = jest.fn((page?: number) => {
            if (page === 0) {
                return Promise.resolve({data: firstPage});
            }
            return Promise.resolve({error: {message: 'Failed to load bots'}});
        });
        const getUser = jest.fn();

        renderWithContext(
            <Bots
                bots={allBots}
                team={team}
                accessTokens={{}}
                owners={{}}
                users={allUsers}
                actions={{...actions, loadBots, getUser}}
                appsEnabled={false}
                appsBotIDs={[]}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Some bot accounts could not be loaded, so this list may be incomplete. Refresh the page to try again.')).toBeInTheDocument();
        });

        // The bots that did load are still rendered alongside the warning.
        expect(screen.getByText(/Bot 1 \(@bot1\)/)).toBeInTheDocument();
        expect(loadBots).toHaveBeenCalledWith(0, 200);
        expect(loadBots).toHaveBeenCalledWith(1, 200);
        expect(loadBots).toHaveBeenCalledTimes(2);
        expect(getUser).toHaveBeenCalledWith('1');
    });

    it('completes loading when the first page fetch returns no data', async () => {
        const loadBots = jest.fn(() => Promise.resolve({}));
        const getUser = jest.fn();

        renderWithContext(
            <Bots
                bots={{}}
                team={team}
                accessTokens={{}}
                owners={{}}
                users={{}}
                actions={{...actions, loadBots, getUser}}
                appsEnabled={false}
                appsBotIDs={[]}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('No bot accounts found')).toBeInTheDocument();
        });
        expect(loadBots).toHaveBeenCalledTimes(1);
        expect(loadBots).toHaveBeenCalledWith(0, 200);
        expect(getUser).not.toHaveBeenCalled();
    });

    it('stops after a single request when there are no bots', async () => {
        const loadBots = jest.fn(() => Promise.resolve({data: []}));
        const getUser = jest.fn();

        renderWithContext(
            <Bots
                bots={{}}
                team={team}
                accessTokens={{}}
                owners={{}}
                users={{}}
                actions={{...actions, loadBots, getUser}}
                appsEnabled={false}
                appsBotIDs={[]}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('No bot accounts found')).toBeInTheDocument();
        });
        expect(loadBots).toHaveBeenCalledTimes(1);
        expect(loadBots).toHaveBeenCalledWith(0, 200);
        expect(getUser).not.toHaveBeenCalled();
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
    });
});
