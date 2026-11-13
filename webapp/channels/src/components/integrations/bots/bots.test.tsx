// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Bot} from '@mattermost/types/bots';

import {renderWithContext, screen, userEvent, waitFor, within} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {TestHelper} from 'utils/test_helper';

import type {BotCreateWarnings} from './bot_create_warnings';
import {BOT_CREATE_WARNINGS_PARAM, serializeBotCreateWarnings} from './bot_create_warnings';
import Bots from './bots';

const TITLE = 'Bot account created, but some settings were not saved';
const TOKEN = "An access token could not be created. Create one from this bot's Create New Token option, or ask a System Admin if you don't have permission.";
const ATTRS = 'Attributes could not be saved. Edit the bot to add them again.';

describe('components/integrations/bots/Bots', () => {
    const team = TestHelper.getTeamMock();
    const actions = {
        loadBots: jest.fn().mockReturnValue(Promise.resolve({data: []})),
        getUserAccessTokensForUser: jest.fn(),
        createUserAccessToken: jest.fn(),
        revokeUserAccessToken: jest.fn(),
        enableUserAccessToken: jest.fn(),
        disableUserAccessToken: jest.fn(),
        rotateUserAccessToken: jest.fn(),
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
                maxLifetimeDays={0}
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
                maxLifetimeDays={0}
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

    it('bots with plugin display names', async () => {
        const bot1 = TestHelper.getBotMock({user_id: '1', owner_id: 'playbooks', username: 'bot1', display_name: 'Bot 1', delete_at: 0});
        const bots = {
            [bot1.user_id]: bot1,
        };
        const users = {
            [bot1.user_id]: TestHelper.getUserMock({id: bot1.user_id}),
        };
        const loadBots = jest.fn().mockReturnValue(Promise.resolve({data: Object.values(bots)}));

        renderWithContext(
            <Bots
                bots={bots}
                team={team}
                accessTokens={{}}
                owners={{}}
                users={users}
                pluginDisplayNames={{[bot1.user_id]: 'Playbooks'}}
                actions={{...actions, loadBots}}
                appsEnabled={false}
                appsBotIDs={[]}
                maxLifetimeDays={0}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Managed by Playbooks plugin')).toBeInTheDocument();
        });
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
                maxLifetimeDays={0}
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
                maxLifetimeDays={0}
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
                maxLifetimeDays={0}
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
                maxLifetimeDays={0}
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
                maxLifetimeDays={0}
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
                maxLifetimeDays={0}
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
                maxLifetimeDays={0}
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

    describe('create warnings', () => {
        const LIST_PATH = `/${team.name}/integrations/bots`;
        const withWarnings = (warnings: BotCreateWarnings) =>
            `${BOT_CREATE_WARNINGS_PARAM}=${encodeURIComponent(serializeBotCreateWarnings(warnings) ?? '')}`;
        const listLocation = (warnings?: BotCreateWarnings, extraSearch = '') => ({
            pathname: LIST_PATH,
            search: warnings ? `?${extraSearch}${extraSearch ? '&' : ''}${withWarnings(warnings)}` : '',
        });
        const replace = getHistory().replace as jest.Mock;
        const listElement = (location?: {pathname: string; search: string}, loadBots = jest.fn().mockResolvedValue({data: []})) => (
            <Bots
                bots={{}}
                team={team}
                accessTokens={{}}
                owners={{}}
                users={{}}
                actions={{...actions, loadBots}}
                appsEnabled={false}
                appsBotIDs={[]}
                maxLifetimeDays={0}
                location={location}
            />
        );
        const renderList = (location?: {pathname: string; search: string}, loadBots?: jest.Mock) => renderWithContext(listElement(location, loadBots));
        const waitForLoaded = () => waitFor(() => expect(screen.getByText('No bot accounts found')).toBeInTheDocument());

        it('shows no banner without location', async () => {
            renderList();
            await waitForLoaded();

            expect(screen.queryByTestId('botCreateWarnings')).toBeNull();
            expect(replace).not.toHaveBeenCalled();
        });

        it('shows no banner when the query has no warnings', async () => {
            const {unmount} = renderList(listLocation());
            await waitForLoaded();
            expect(screen.queryByTestId('botCreateWarnings')).toBeNull();
            unmount();

            renderList({pathname: LIST_PATH, search: '?foo=1'});
            await waitForLoaded();
            expect(screen.queryByTestId('botCreateWarnings')).toBeNull();
            expect(replace).not.toHaveBeenCalled();
        });

        it('shows the warnings from the query in the banner', async () => {
            renderList(listLocation({tokenFailed: true, attributesFailed: true}));
            await waitForLoaded();

            const banner = screen.getByTestId('botCreateWarnings');
            expect(within(banner).getByText(TITLE)).toBeInTheDocument();
            expect(within(banner).getByText(TOKEN)).toBeInTheDocument();
            expect(within(banner).getByText(ATTRS)).toBeInTheDocument();
        });

        it('removes bot_warnings from the URL and keeps the banner', async () => {
            renderList(listLocation({tokenFailed: true}));
            await waitForLoaded();

            expect(replace).toHaveBeenCalledTimes(1);
            expect(replace).toHaveBeenCalledWith(LIST_PATH);
            expect(screen.getByTestId('botCreateWarnings')).toBeInTheDocument();
        });

        it('keeps other query params when removing bot_warnings', async () => {
            renderList(listLocation({tokenFailed: true}, 'foo=1'));
            await waitForLoaded();

            expect(replace).toHaveBeenCalledTimes(1);
            expect(replace).toHaveBeenCalledWith(`${LIST_PATH}?foo=1`);
        });

        it('dismissing hides the banner', async () => {
            renderList(listLocation({tokenFailed: true}));
            await waitForLoaded();

            const banner = screen.getByTestId('botCreateWarnings');
            await userEvent.click(within(banner).getByRole('button', {name: 'Close'}));

            expect(screen.queryByTestId('botCreateWarnings')).toBeNull();
        });

        it('shows the warning once: it survives the cleanup rerender but not a fresh mount', async () => {
            const {rerender, unmount} = renderList(listLocation({tokenFailed: true}, 'foo=1'));
            await waitForLoaded();
            const cleanedSearch = String(replace.mock.calls[0][0]).slice(LIST_PATH.length);
            expect(cleanedSearch).toBe('?foo=1');

            rerender(listElement({pathname: LIST_PATH, search: cleanedSearch}));
            expect(within(screen.getByTestId('botCreateWarnings')).getByText(TOKEN)).toBeInTheDocument();
            expect(replace).toHaveBeenCalledTimes(1);
            unmount();

            renderList({pathname: LIST_PATH, search: cleanedSearch});
            await waitForLoaded();
            expect(screen.queryByTestId('botCreateWarnings')).toBeNull();
            expect(replace).toHaveBeenCalledTimes(1);
        });

        it('strips an unrecognized bot_warnings value without showing a banner', async () => {
            renderList({pathname: LIST_PATH, search: `?foo=1&${BOT_CREATE_WARNINGS_PARAM}=foo`});
            await waitForLoaded();

            expect(screen.queryByTestId('botCreateWarnings')).toBeNull();
            expect(replace).toHaveBeenCalledTimes(1);
            expect(replace).toHaveBeenCalledWith(`${LIST_PATH}?foo=1`);
        });

        it('shows the warning above the load error', async () => {
            renderList(listLocation({tokenFailed: true}), jest.fn().mockResolvedValue({error: {message: 'x'}}));

            const loadError = await screen.findByText('Bot accounts could not be loaded. Refresh the page to try again.');
            const banner = screen.getByTestId('botCreateWarnings');
            expect(banner.compareDocumentPosition(loadError) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        });
    });
});
