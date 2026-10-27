// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {BotEventSubscription} from '@mattermost/types/bots';

import {enableBotEventSubscription, getBotEventSubscription, regenerateBotEventSubscriptionSecret} from 'mattermost-redux/actions/bots';

import {renderWithContext, screen, userEvent, waitFor, within} from 'tests/react_testing_utils';

import BotEventSubscriptionStatus from './bot_event_subscription_status';

jest.mock('mattermost-redux/actions/bots', () => ({
    getBotEventSubscription: jest.fn(),
    enableBotEventSubscription: jest.fn(),
    regenerateBotEventSubscriptionSecret: jest.fn(),
}));

const mockResult = (fn: unknown, result: unknown) => (fn as jest.Mock).mockReturnValue(() => Promise.resolve(result));

describe('components/integrations/bots/BotEventSubscriptionStatus', () => {
    const subscription: BotEventSubscription = {
        bot_user_id: 'bot1',
        mode: 'push',
        callback_url: 'https://example.com/hook',
        ignore_bot_authors: true,
        enabled: true,
        disabled_reason: '',
        last_delivered_at: 0,
    };

    const renderStatus = (sub: BotEventSubscription | null) => {
        mockResult(getBotEventSubscription, {data: sub});
        return renderWithContext(<BotEventSubscriptionStatus botUserId='bot1'/>);
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders nothing without a subscription', async () => {
        const {container} = renderStatus(null);

        await waitFor(() => expect(getBotEventSubscription).toHaveBeenCalledWith('bot1'));
        expect(container).toBeEmptyDOMElement();
    });

    test('an active push subscription shows its mode, badge and last delivery', async () => {
        renderStatus({...subscription, last_delivered_at: new Date(2026, 5, 15, 12).getTime()});

        expect(await screen.findByText(/Event delivery:\s+Push/)).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.queryByText(/Last delivered:\s+Never/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Enable delivery'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Regenerate secret'})).toBeInTheDocument();
    });

    test('pull subscriptions have no regenerate action', async () => {
        renderStatus({...subscription, mode: 'pull'});

        expect(await screen.findByText(/Event delivery:\s+Pull/)).toBeInTheDocument();
        expect(screen.getByText(/Last delivered:\s+Never/)).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Regenerate secret'})).not.toBeInTheDocument();
    });

    test.each([
        ['delivery_failures', "The callback URL hasn't accepted events for more than 24 hours."],
        ['callback_gone', 'The callback URL responded with 410 Gone.'],
        ['manual', 'Delivery is turned off.'],
    ])('a subscription disabled for %s shows the reason', async (reason, text) => {
        renderStatus({...subscription, enabled: false, disabled_reason: reason as BotEventSubscription['disabled_reason']});

        expect(await screen.findByText('Disabled')).toBeInTheDocument();
        expect(screen.getByText(text)).toBeInTheDocument();
    });

    test('enabling delivery shows the response and removes the button', async () => {
        mockResult(enableBotEventSubscription, {data: subscription});
        renderStatus({...subscription, enabled: false, disabled_reason: 'delivery_failures'});

        await userEvent.click(await screen.findByRole('button', {name: 'Enable delivery'}));

        expect(await screen.findByText('Active')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Enable delivery'})).not.toBeInTheDocument();
        expect(enableBotEventSubscription).toHaveBeenCalledWith('bot1');
    });

    test('an enable error is shown', async () => {
        mockResult(enableBotEventSubscription, {error: {message: 'Callback URL is unreachable.'}});
        renderStatus({...subscription, enabled: false, disabled_reason: 'delivery_failures'});

        await userEvent.click(await screen.findByRole('button', {name: 'Enable delivery'}));

        expect(await screen.findByText('Callback URL is unreachable.')).toBeInTheDocument();
        expect(screen.getByText('Disabled')).toBeInTheDocument();
    });

    test('regenerating shows the new secret once, after confirmation', async () => {
        mockResult(regenerateBotEventSubscriptionSecret, {data: {...subscription, secret: 'whsec_new'}});
        renderStatus(subscription);

        await userEvent.click(await screen.findByRole('button', {name: 'Regenerate secret'}));
        expect(regenerateBotEventSubscriptionSecret).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: 'Yes, Regenerate'}));

        expect(await screen.findByText('whsec_new')).toBeInTheDocument();
        expect(regenerateBotEventSubscriptionSecret).toHaveBeenCalledWith('bot1');

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        const alert = screen.getByText('whsec_new').closest('.alert') as HTMLElement;
        await userEvent.click(within(alert).getByRole('button', {name: 'Close'}));
        expect(screen.queryByText('whsec_new')).not.toBeInTheDocument();
    });
});
