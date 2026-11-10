// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Bot} from '@mattermost/types/bots';
import type {IncomingWebhook, OAuthApp, OutgoingOAuthConnection, OutgoingWebhook} from '@mattermost/types/integrations';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import type {BotCreateWarnings} from 'components/integrations/bots/bot_create_warnings';
import {BOT_CREATE_WARNINGS_PARAM, serializeBotCreateWarnings} from 'components/integrations/bots/bot_create_warnings';
import {setPendingBotToken, takePendingBotToken} from 'components/integrations/bots/bot_pending_token';
import ConfirmIntegration from 'components/integrations/confirm_integration/confirm_integration';

import {renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {ErrorPageTypes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

const TITLE = 'Bot account created, but some settings were not saved';
const ROLES = 'The role and post permissions could not be saved. Edit the bot to set them again.';
const ATTRS = 'Attributes could not be saved. Edit the bot to add them again.';

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
        pathname: '/team_test/integrations/confirm',
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
    const outgoingOAuthConnection = {
        id,
        audiences: ['https://myaudience.com'],
        client_id: 'someid',
        client_secret: '',
        grant_type: 'client_credentials',
        name: 'My OAuth Connection',
        oauth_token_url: 'https://tokenurl.com',
    };

    const userId = 'b5tpgt4iepf45jt768jz84djhd';
    const bot = TestHelper.getBotMock({
        user_id: userId,
        display_name: 'bot',
    });
    const commands = {[id]: TestHelper.getCommandMock({id, token})};
    const oauthApps = {[id]: oauthApp} as unknown as IDMappedObjects<OAuthApp>;
    const outgoingOAuthConnections = {[id]: outgoingOAuthConnection} as unknown as IDMappedObjects<OutgoingOAuthConnection>;
    const incomingHooks: IDMappedObjects<IncomingWebhook> = {[id]: TestHelper.getIncomingWebhookMock({id})};
    const outgoingHooks = {[id]: {id, token}} as unknown as IDMappedObjects<OutgoingWebhook>;
    const bots: Record<string, Bot> = {[userId]: bot};

    const props = {
        team,
        location,
        commands,
        oauthApps,
        outgoingOAuthConnections,
        incomingHooks,
        outgoingHooks,
        bots,
    };

    test('should match snapshot, oauthApps case', () => {
        props.location.search = getSearchString('oauth2-apps');
        const {container} = renderWithContext(
            <ConfirmIntegration {...props}/>,
            initialState,
        );
        expect(screen.getByText('Setup Successful')).toBeInTheDocument();
        expect(screen.getByText('OAuth 2.0 Applications')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should match callback URLs of OAuth Apps', () => {
        props.location.search = getSearchString('oauth2-apps');
        const {container} = renderWithContext(
            <ConfirmIntegration {...props}/>,
            initialState,
        );

        expect(container.querySelector('.word-break--all')).toHaveTextContent('URL(s): https://someCallback, https://anotherCallback');
    });

    test('should match snapshot, outgoingOAuthConnections case', () => {
        props.location.search = getSearchString('outgoing-oauth2-connections');
        const {container} = renderWithContext(
            <ConfirmIntegration {...props}/>,
            initialState,
        );
        expect(screen.getByText('Setup Successful')).toBeInTheDocument();
        expect(screen.getByText('Outgoing OAuth Connections')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, commands case', () => {
        props.location.search = getSearchString('commands');
        const {container} = renderWithContext(
            <ConfirmIntegration {...props}/>,
            initialState,
        );
        expect(screen.getByText('Setup Successful')).toBeInTheDocument();
        expect(screen.getAllByText('Slash Commands').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(token)).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, incomingHooks case', () => {
        props.location.search = getSearchString('incoming_webhooks');
        const {container} = renderWithContext(
            <ConfirmIntegration {...props}/>,
            initialState,
        );
        expect(screen.getByText('Setup Successful')).toBeInTheDocument();
        expect(screen.getAllByText('Incoming Webhooks').length).toBeGreaterThanOrEqual(1);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, outgoingHooks case', () => {
        props.location.search = getSearchString('outgoing_webhooks');
        const {container} = renderWithContext(
            <ConfirmIntegration {...props}/>,
            initialState,
        );
        expect(screen.getByText('Setup Successful')).toBeInTheDocument();
        expect(screen.getAllByText('Outgoing Webhooks').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(token)).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, outgoingHooks and bad identifier case', () => {
        props.location.search = getSearchString('outgoing_webhooks', 'bad');
        const {container} = renderWithContext(
            <ConfirmIntegration {...props}/>,
            initialState,
        );

        // Bad identifier means integration not found, redirects to error page
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, bad integration type case', () => {
        props.location.search = getSearchString('bad');
        const {container} = renderWithContext(
            <ConfirmIntegration {...props}/>,
            initialState,
        );

        // Bad type means redirect to error page
        expect(container).toMatchSnapshot();
    });

    describe('bot create warnings', () => {
        const CONFIRM_PATH = '/team_test/integrations/confirm';
        const withWarnings = (warnings: BotCreateWarnings) =>
            `${BOT_CREATE_WARNINGS_PARAM}=${encodeURIComponent(serializeBotCreateWarnings(warnings) ?? '')}`;

        const replace = getHistory().replace as jest.Mock;

        const confirmElement = (search: string) => (
            <ConfirmIntegration
                {...props}
                location={{pathname: CONFIRM_PATH, search}}
            />
        );
        const renderConfirm = (search: string) => renderWithContext(confirmElement(search), initialState);
        const confirmQuery = `?type=bots&id=${userId}`;
        const botSearch = (warnings?: BotCreateWarnings) =>
            confirmQuery + (warnings ? `&${withWarnings(warnings)}` : '');
        const seedBotToken = () => setPendingBotToken(userId, token);
        const botsListPath = `/${team.name}/integrations/bots`;
        const otherToken = 'aaaaaaaaaaaaaaaaaaaaaaaaaa';

        afterEach(() => {
            takePendingBotToken(userId);
            takePendingBotToken('other-id');
            takePendingBotToken(userId.slice(0, -1));
            takePendingBotToken(`${userId}x`);
            takePendingBotToken('c5tpgt4iepf45jt768jz84djhd');
        });

        test('bot without warnings shows token and no banner', () => {
            seedBotToken();
            renderConfirm(`${botSearch()}&token=${otherToken}`);

            expect(screen.getByText(token)).toBeInTheDocument();
            expect(screen.queryByText(otherToken)).not.toBeInTheDocument();
            expect(screen.queryByTestId('botCreateWarnings')).toBeNull();
            expect(replace).not.toHaveBeenCalled();
        });

        test('bot with warnings shows the banner above the help text and keeps the token', () => {
            seedBotToken();
            renderConfirm(botSearch({attributesFailed: true}));

            const banner = screen.getByTestId('botCreateWarnings');
            expect(within(banner).getByText(TITLE)).toBeInTheDocument();
            expect(within(banner).getByText(ATTRS)).toBeInTheDocument();
            expect(screen.getByText(token)).toBeInTheDocument();

            const helpText = screen.getByText(/has been created successfully/);
            expect(banner.compareDocumentPosition(helpText) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        });

        test('removes bot_warnings from the URL, keeps type and id, and keeps the banner', () => {
            seedBotToken();
            renderConfirm(botSearch({attributesFailed: true}));

            expect(replace).toHaveBeenCalledTimes(1);
            expect(replace).toHaveBeenCalledWith(`${CONFIRM_PATH}${confirmQuery}`);

            const params = new URLSearchParams(String(replace.mock.calls[0][0]).split('?')[1]);
            expect(params.get('type')).toBe('bots');
            expect(params.get('id')).toBe(userId);
            expect(params.has('token')).toBe(false);
            expect(params.has(BOT_CREATE_WARNINGS_PARAM)).toBe(false);

            expect(screen.getByTestId('botCreateWarnings')).toBeInTheDocument();
            expect(screen.getByText(token)).toBeInTheDocument();
        });

        test('keeps the other params when bot_warnings is not last', () => {
            seedBotToken();
            renderConfirm(`?type=bots&${withWarnings({rolesFailed: true})}&id=${userId}`);

            expect(replace).toHaveBeenCalledTimes(1);
            expect(replace).toHaveBeenCalledWith(`${CONFIRM_PATH}${confirmQuery}`);
            expect(within(screen.getByTestId('botCreateWarnings')).getByText(ROLES)).toBeInTheDocument();
        });

        test('dismissing hides the banner', async () => {
            seedBotToken();
            renderConfirm(botSearch({attributesFailed: true}));

            const banner = screen.getByTestId('botCreateWarnings');
            await userEvent.click(within(banner).getByRole('button', {name: 'Close'}));

            expect(screen.queryByTestId('botCreateWarnings')).toBeNull();
            expect(screen.getByText(token)).toBeInTheDocument();
        });

        test('non-bot confirmation ignores bot warnings', () => {
            renderConfirm(`?type=commands&id=${id}&${withWarnings({attributesFailed: true})}`);

            expect(screen.queryByTestId('botCreateWarnings')).toBeNull();
            expect(screen.getByText(token)).toBeInTheDocument();
            expect(replace).not.toHaveBeenCalled();
        });

        test('unknown bot id with warnings only redirects to the error page', () => {
            renderConfirm(`?type=bots&id=unknown&${withWarnings({attributesFailed: true})}`);

            expect(screen.queryByTestId('botCreateWarnings')).toBeNull();
            expect(replace).toHaveBeenCalled();
            for (const [path] of replace.mock.calls) {
                expect(path).toBe(`/error?type=${ErrorPageTypes.PAGE_NOT_FOUND}`);
            }
        });

        test('shows the warning once: it survives the cleanup rerender but not a fresh mount', () => {
            seedBotToken();
            const {rerender, unmount} = renderConfirm(botSearch({attributesFailed: true}));
            const cleanedSearch = String(replace.mock.calls[0][0]).slice(CONFIRM_PATH.length);
            expect(cleanedSearch).toBe(confirmQuery);

            rerender(confirmElement(cleanedSearch));
            expect(within(screen.getByTestId('botCreateWarnings')).getByText(ATTRS)).toBeInTheDocument();
            expect(screen.getByText(token)).toBeInTheDocument();
            expect(replace).toHaveBeenCalledTimes(1);
            unmount();

            seedBotToken();
            renderConfirm(cleanedSearch);
            expect(screen.queryByTestId('botCreateWarnings')).toBeNull();
            expect(screen.getByText(token)).toBeInTheDocument();
            expect(replace).toHaveBeenCalledTimes(1);
        });

        test('strips an unrecognized bot_warnings value without showing a banner', () => {
            seedBotToken();
            renderConfirm(`${botSearch()}&${BOT_CREATE_WARNINGS_PARAM}=foo`);

            expect(screen.queryByTestId('botCreateWarnings')).toBeNull();
            expect(screen.getByText(token)).toBeInTheDocument();
            expect(replace).toHaveBeenCalledTimes(1);
            expect(replace).toHaveBeenCalledWith(`${CONFIRM_PATH}${confirmQuery}`);
        });

        test.each([
            ['no pending token', () => undefined, confirmQuery],
            ['a token query param', () => undefined, `${confirmQuery}&token=${token}`],
            ['an encoded token query param', () => undefined, `${confirmQuery}&token=${encodeURIComponent(token)}`],
            ['a Token query param', () => undefined, `${confirmQuery}&Token=${token}`],
            ['an empty token query param', () => undefined, `${confirmQuery}&token=`],
            ['a token query param and warnings', () => undefined, `${botSearch({rolesFailed: true})}&token=${token}`],
            ['an empty pending token', () => setPendingBotToken(userId, ''), confirmQuery],
            ['a pending token for another id', () => setPendingBotToken('other-id', token), confirmQuery],
            ['a pending token for a prefix of the id', () => setPendingBotToken(userId.slice(0, -1), token), confirmQuery],
            ['a pending token for an id that starts with this id', () => setPendingBotToken(`${userId}x`, token), confirmQuery],
        ])('%s sends the user to the bots list', (_, seed, search) => {
            seed();
            renderConfirm(search);

            expect(screen.queryByText(token)).not.toBeInTheDocument();
            expect(replace).toHaveBeenCalledWith(botsListPath);
        });

        test('the token is still shown when effects run twice on mount', () => {
            seedBotToken();
            renderWithContext(<React.StrictMode>{confirmElement(botSearch())}</React.StrictMode>, initialState);

            expect(screen.getByText(token)).toBeInTheDocument();
            expect(replace).not.toHaveBeenCalledWith(botsListPath);
        });

        test('a different bot id on the same mount shows that bot\'s own token', () => {
            const secondUserId = 'c5tpgt4iepf45jt768jz84djhd';
            const secondToken = 'zzzzzzzzzzzzzzzzzzzzzzzzzz';
            const twoBots = {
                [userId]: bot,
                [secondUserId]: TestHelper.getBotMock({user_id: secondUserId, display_name: 'second bot'}),
            };
            const element = (search: string) => (
                <ConfirmIntegration
                    {...props}
                    bots={twoBots}
                    location={{pathname: CONFIRM_PATH, search}}
                />
            );
            seedBotToken();

            const {rerender} = renderWithContext(element(confirmQuery), initialState);
            expect(screen.getByText(token)).toBeInTheDocument();

            setPendingBotToken(secondUserId, secondToken);
            rerender(element(`?type=bots&id=${secondUserId}`));
            expect(screen.getByText(secondToken)).toBeInTheDocument();
            expect(screen.queryByText(token)).not.toBeInTheDocument();
        });

        test('a remount after the first visit goes to the bots list', () => {
            seedBotToken();
            const {unmount} = renderConfirm(botSearch());
            expect(screen.getByText(token)).toBeInTheDocument();
            unmount();

            renderConfirm(botSearch());
            expect(screen.queryByText(token)).not.toBeInTheDocument();
            expect(replace).toHaveBeenCalledWith(botsListPath);
        });
    });
});
