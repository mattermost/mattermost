// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {generateId} from 'mattermost-redux/utils/helpers';

import {fireEvent, renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper as UtilsTestHelper} from 'utils/test_helper';
import * as Utils from 'utils/utils';

import Bot from './bot';

describe('components/integrations/bots/Bot', () => {
    const team = UtilsTestHelper.getTeamMock();
    const FROZEN_NOW = new Date(2026, 5, 15, 12, 0, 0).getTime();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const actions = {
        disableBot: jest.fn(),
        enableBot: jest.fn(),
        createUserAccessToken: jest.fn(),
        revokeUserAccessToken: jest.fn(),
        enableUserAccessToken: jest.fn(),
        disableUserAccessToken: jest.fn(),
        rotateUserAccessToken: jest.fn(),
    };

    beforeAll(() => {
        jest.useFakeTimers().setSystemTime(FROZEN_NOW);
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('plugin-managed bot shows the managing plugin id', () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1', owner_id: 'com.mattermost.calls'});
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
                maxLifetimeDays={0}
            />,
        );

        expect(screen.getByText(/\(@\)/)).toBeInTheDocument();
        expect(screen.getByText('Managed by plugin com.mattermost.calls')).toBeInTheDocument();

        // if bot managed by plugin, remove ability to edit from UI
        expect(screen.queryByText('Create New Token')).not.toBeInTheDocument();
        expect(screen.queryByText('Edit')).not.toBeInTheDocument();
        expect(screen.queryByText(/^Disable$/)).not.toBeInTheDocument();
        expect(screen.queryByText(/^Enable$/)).not.toBeInTheDocument();
    });

    it('plugin-managed bot shows the managing plugin display name', () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1', owner_id: 'com.mattermost.calls'});
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        renderWithContext(
            <Bot
                bot={bot}
                user={user}
                owner={undefined}
                pluginDisplayName='Calls'
                accessTokens={{}}
                team={team}
                actions={actions}
                fromApp={false}
                maxLifetimeDays={0}
            />,
        );

        expect(screen.getByText('Managed by Calls plugin')).toBeInTheDocument();
        expect(screen.queryByText('Managed by plugin com.mattermost.calls')).not.toBeInTheDocument();
    });

    it('plugin-managed bot without a known plugin id falls back to a generic label', () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1', owner_id: ''});
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
                maxLifetimeDays={0}
            />,
        );

        expect(screen.getByText('Managed by a plugin')).toBeInTheDocument();
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
                maxLifetimeDays={0}
            />,
        );

        expect(screen.getByText(/\(@\)/)).toBeInTheDocument();
        expect(screen.getByText('Managed by Apps Framework')).toBeInTheDocument();

        // if bot managed by app framework, ability to edit from UI is retained
        expect(screen.getByText('Create New Token')).toBeInTheDocument();
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('Disable')).toBeInTheDocument();
        expect(screen.queryByText(/^Enable$/)).not.toBeInTheDocument();
    });

    it('app bot takes precedence over a plugin owner id', () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1', owner_id: 'com.mattermost.calls'});
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
                maxLifetimeDays={0}
            />,
        );

        expect(screen.getByText('Managed by Apps Framework')).toBeInTheDocument();
        expect(screen.queryByText(/Managed by plugin/)).not.toBeInTheDocument();
    });

    it('disabled plugin bot keeps the plugin id and only offers Enable', () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1', owner_id: 'com.mattermost.calls'});
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
                maxLifetimeDays={0}
            />,
        );
        expect(screen.getByText(/\(@\)/)).toBeInTheDocument();
        expect(screen.getByText('Managed by plugin com.mattermost.calls')).toBeInTheDocument();
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
                maxLifetimeDays={0}
            />,
        );
        expect(screen.getByText(`Managed by ${owner.username}`)).toBeInTheDocument();
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
                maxLifetimeDays={0}
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
                maxLifetimeDays={0}
            />,
        );

        expect(screen.getByText(tokenId)).toBeInTheDocument();
        expect(screen.queryByText(/^Disable$/)).not.toBeInTheDocument();
        expect(screen.getByText(/^Enable$/)).toBeInTheDocument();
    });

    it('supports optional expiry when creating a token for a user-owned bot without a policy', async () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1', owner_id: 'owner1'});
        const owner = UtilsTestHelper.getUserMock({id: bot.owner_id, username: 'owner1'});
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        const createUserAccessToken = jest.fn().mockResolvedValue({data: UtilsTestHelper.getUserAccessTokenMock({id: 't1', token: 'secret'})});

        renderWithContext(
            <Bot
                bot={bot}
                owner={owner}
                user={user}
                accessTokens={{}}
                team={team}
                actions={{...actions, createUserAccessToken}}
                fromApp={false}
                maxLifetimeDays={0}
            />,
        );

        fireEvent.click(screen.getByText('Create New Token'));
        expect(screen.getByText('No expiry')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Token Description:'), {target: {value: 'deploy token'}});
        fireEvent.click(screen.getByText('Save'));

        await waitFor(() => expect(createUserAccessToken).toHaveBeenCalledWith(bot.user_id, 'deploy token', undefined));
    });

    it('requires and clamps expiry when creating a token for a user-owned bot with a maximum lifetime policy', async () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1', owner_id: 'owner1'});
        const owner = UtilsTestHelper.getUserMock({id: bot.owner_id, username: 'owner1'});
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        const createUserAccessToken = jest.fn().mockResolvedValue({data: UtilsTestHelper.getUserAccessTokenMock({id: 't1', token: 'secret'})});

        renderWithContext(
            <Bot
                bot={bot}
                owner={owner}
                user={user}
                accessTokens={{}}
                team={team}
                actions={{...actions, createUserAccessToken}}
                fromApp={false}
                maxLifetimeDays={30}
            />,
        );

        fireEvent.click(screen.getByText('Create New Token'));
        expect(screen.queryByText('No expiry')).not.toBeInTheDocument();
        expect(screen.getByText('Tokens can be valid for up to 30 days.')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Token Description:'), {target: {value: 'deploy token'}});
        fireEvent.click(screen.getByText('Save'));

        await waitFor(() => expect(createUserAccessToken).toHaveBeenCalledWith(bot.user_id, 'deploy token', FROZEN_NOW + (30 * DAY_MS)));
    });

    it('hides expiry presets longer than the configured maximum', () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1', owner_id: 'owner1'});
        const owner = UtilsTestHelper.getUserMock({id: bot.owner_id, username: 'owner1'});
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
                maxLifetimeDays={7}
            />,
        );

        fireEvent.click(screen.getByText('Create New Token'));
        expect(screen.getByText('7 days')).toBeInTheDocument();
        expect(screen.queryByText('30 days')).not.toBeInTheDocument();
        expect(screen.queryByText('90 days')).not.toBeInTheDocument();
        expect(screen.queryByText('1 year')).not.toBeInTheDocument();
    });

    it('preserves the Apps-owned bot token creation UX under a maximum lifetime policy', async () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1', owner_id: 'com.mattermost.apps'});
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        const createUserAccessToken = jest.fn().mockResolvedValue({data: UtilsTestHelper.getUserAccessTokenMock({id: 't1', token: 'secret'})});

        renderWithContext(
            <Bot
                bot={bot}
                user={user}
                owner={undefined}
                accessTokens={{}}
                team={team}
                actions={{...actions, createUserAccessToken}}
                fromApp={true}
                maxLifetimeDays={30}
            />,
        );

        fireEvent.click(screen.getByText('Create New Token'));
        expect(screen.queryByText('No expiry')).not.toBeInTheDocument();
        expect(screen.queryByText('Tokens can be valid for up to 30 days.')).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Token Description:'), {target: {value: 'app token'}});
        fireEvent.click(screen.getByText('Save'));

        await waitFor(() => expect(createUserAccessToken).toHaveBeenCalledWith(bot.user_id, 'app token', undefined));
    });

    it('displays user-owned bot token expiry and status states', () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1', owner_id: 'owner1'});
        const owner = UtilsTestHelper.getUserMock({id: bot.owner_id, username: 'owner1'});
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        const accessTokens = {
            active: UtilsTestHelper.getUserAccessTokenMock({id: 'active', user_id: bot.user_id, is_active: true}),
            expired: UtilsTestHelper.getUserAccessTokenMock({id: 'expired', user_id: bot.user_id, is_active: true, expires_at: FROZEN_NOW - DAY_MS}),
            inactive: UtilsTestHelper.getUserAccessTokenMock({id: 'inactive', user_id: bot.user_id, is_active: false, expires_at: FROZEN_NOW + DAY_MS}),
            expiring: UtilsTestHelper.getUserAccessTokenMock({id: 'expiring', user_id: bot.user_id, is_active: true, expires_at: FROZEN_NOW + (3 * DAY_MS)}),
        };

        renderWithContext(
            <Bot
                bot={bot}
                owner={owner}
                user={user}
                accessTokens={accessTokens}
                team={team}
                actions={actions}
                fromApp={false}
                maxLifetimeDays={0}
            />,
        );

        expect(screen.getAllByText('Active')).toHaveLength(2);
        expect(screen.getByText('Expired')).toBeInTheDocument();
        expect(screen.getByText('Disabled')).toBeInTheDocument();
        expect(screen.getByText('Never')).toBeInTheDocument();
        expect(screen.getByText('Expires in 3 days')).toBeInTheDocument();
    });

    it('regenerates a user-owned bot token with a required expiry and shows the new secret', async () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1', owner_id: 'owner1'});
        const owner = UtilsTestHelper.getUserMock({id: bot.owner_id, username: 'owner1'});
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        const rotateUserAccessToken = jest.fn().mockResolvedValue({data: UtilsTestHelper.getUserAccessTokenMock({id: 't1', user_id: bot.user_id, token: 'new-secret'})});
        const accessTokens = {
            t1: UtilsTestHelper.getUserAccessTokenMock({id: 't1', user_id: bot.user_id, is_active: true, description: 'old token'}),
        };

        renderWithContext(
            <Bot
                bot={bot}
                owner={owner}
                user={user}
                accessTokens={accessTokens}
                team={team}
                actions={{...actions, rotateUserAccessToken}}
                fromApp={false}
                maxLifetimeDays={30}
            />,
        );

        fireEvent.click(screen.getByText('Regenerate'));
        expect(screen.getByText('Regenerate Token?')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Yes, Regenerate'));

        await screen.findByText(/new-secret/);
        expect(rotateUserAccessToken).toHaveBeenCalledWith('t1', FROZEN_NOW + (30 * DAY_MS));
    });

    it('copies a newly generated bot token secret from the one-time display', async () => {
        const bot = UtilsTestHelper.getBotMock({user_id: '1', owner_id: 'owner1'});
        const owner = UtilsTestHelper.getUserMock({id: bot.owner_id, username: 'owner1'});
        const user = UtilsTestHelper.getUserMock({id: bot.user_id});
        const createUserAccessToken = jest.fn().mockResolvedValue({data: UtilsTestHelper.getUserAccessTokenMock({id: 't1', user_id: bot.user_id, token: 'new-secret'})});
        const copyToClipboard = jest.spyOn(Utils, 'copyToClipboard').mockImplementation(jest.fn());

        renderWithContext(
            <Bot
                bot={bot}
                owner={owner}
                user={user}
                accessTokens={{}}
                team={team}
                actions={{...actions, createUserAccessToken}}
                fromApp={false}
                maxLifetimeDays={0}
            />,
        );

        fireEvent.click(screen.getByText('Create New Token'));
        fireEvent.change(screen.getByLabelText('Token Description:'), {target: {value: 'deploy token'}});
        fireEvent.click(screen.getByText('Save'));

        await screen.findByText(/new-secret/);
        fireEvent.click(screen.getByLabelText('Copy Token'));

        expect(copyToClipboard).toHaveBeenCalledWith('new-secret');
    });
});
