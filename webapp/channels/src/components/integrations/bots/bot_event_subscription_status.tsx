// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {defineMessages, FormattedMessage} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import type {BotEventDisabledReason, BotEventSubscription} from '@mattermost/types/bots';

import {enableBotEventSubscription, getBotEventSubscription, regenerateBotEventSubscriptionSecret} from 'mattermost-redux/actions/bots';

import ConfirmModal from 'components/confirm_modal';
import Timestamp from 'components/timestamp';

import {eventDeliveryModeMessages} from './add_bot/bot_event_delivery';
import BotEventSecret from './bot_event_secret';

const messages = defineMessages({
    label: {id: 'bots.event_delivery.label', defaultMessage: 'Event delivery:'},
    active: {id: 'bots.event_delivery.status.active', defaultMessage: 'Active'},
    disabled: {id: 'bots.event_delivery.status.disabled', defaultMessage: 'Disabled'},
    deliveryFailures: {id: 'bots.event_delivery.disabled.delivery_failures', defaultMessage: "The callback URL hasn't accepted events for more than 24 hours."},
    callbackGone: {id: 'bots.event_delivery.disabled.callback_gone', defaultMessage: 'The callback URL responded with 410 Gone.'},
    unknownReason: {id: 'bots.event_delivery.disabled.unknown', defaultMessage: 'Delivery is turned off.'},
    lastDelivered: {id: 'bots.event_delivery.last_delivered', defaultMessage: 'Last delivered:'},
    never: {id: 'bots.event_delivery.never', defaultMessage: 'Never'},
    enable: {id: 'bots.event_delivery.enable', defaultMessage: 'Enable delivery'},
    regenerate: {id: 'bots.event_delivery.regenerate', defaultMessage: 'Regenerate secret'},
    regenerateTitle: {id: 'bots.event_delivery.regenerate.title', defaultMessage: 'Regenerate Signing Secret?'},
    regenerateMessage: {id: 'bots.event_delivery.regenerate.message', defaultMessage: 'The current secret stops working immediately.'},
    confirmRegenerate: {id: 'user.settings.tokens.confirmRegenerateButton', defaultMessage: 'Yes, Regenerate'},
    close: {id: 'bot.create_token.close', defaultMessage: 'Close'},
});

// A Record keeps this exhaustive over known reasons; newer servers may send others, hence the fallback at the use site.
const disabledReasonMessages: Record<BotEventDisabledReason, MessageDescriptor> = {
    '': messages.unknownReason,
    delivery_failures: messages.deliveryFailures,
    callback_gone: messages.callbackGone,
};

type Props = {
    botUserId: string;
};

export default function BotEventSubscriptionStatus({botUserId}: Props) {
    const dispatch = useDispatch();
    const [subscription, setSubscription] = useState<BotEventSubscription | null>(null);
    const [error, setError] = useState('');
    const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);
    const [secret, setSecret] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const result = await dispatch(getBotEventSubscription(botUserId));
            if (!cancelled && result.data) {
                setSubscription(result.data);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [botUserId, dispatch]);

    if (!subscription) {
        return null;
    }

    const enable = async () => {
        const result = await dispatch(enableBotEventSubscription(botUserId));
        setError(result.error ? result.error.message : '');
        if (result.data) {
            setSubscription(result.data);
        }
    };

    const regenerate = async () => {
        setConfirmingRegenerate(false);
        const result = await dispatch(regenerateBotEventSubscriptionSecret(botUserId));
        setError(result.error ? result.error.message : '');
        if (result.data) {
            setSecret(result.data.secret ?? '');
        }
    };

    const {enabled, mode, last_delivered_at: lastDeliveredAt} = subscription;
    return (
        <>
            <div className='light small mt-1'>
                <FormattedMessage {...messages.label}/>
                {' '}
                <FormattedMessage {...eventDeliveryModeMessages[mode]}/>
                {' '}
                <span className={`bot-event-subscription__status bot-event-subscription__status--${enabled ? 'active' : 'inactive'}`}>
                    <FormattedMessage {...(enabled ? messages.active : messages.disabled)}/>
                </span>
                {!enabled && (
                    <span>{' '}<FormattedMessage {...(disabledReasonMessages[subscription.disabled_reason] ?? messages.unknownReason)}/></span>
                )}
            </div>
            <div className='light small'>
                <FormattedMessage {...messages.lastDelivered}/>
                {' '}
                {lastDeliveredAt ? <Timestamp value={lastDeliveredAt}/> : (
                    <FormattedMessage {...messages.never}/>
                )}
            </div>
            <div className='mt-1'>
                {!enabled && (
                    <button
                        className='style--none color--link'
                        onClick={enable}
                    >
                        <FormattedMessage {...messages.enable}/>
                    </button>
                )}
                {!enabled && mode === 'push' && ' - '}
                {mode === 'push' && (
                    <button
                        className='style--none color--link'
                        onClick={() => setConfirmingRegenerate(true)}
                    >
                        <FormattedMessage {...messages.regenerate}/>
                    </button>
                )}
            </div>
            {error && <div className='has-error mt-2'>{error}</div>}
            {secret && (
                <BotEventSecret secret={secret}>
                    <div className='mt-2'>
                        <Button
                            emphasis='primary'
                            size='sm'
                            onClick={() => setSecret('')}
                        >
                            <FormattedMessage {...messages.close}/>
                        </Button>
                    </div>
                </BotEventSecret>
            )}
            <ConfirmModal
                title={<FormattedMessage {...messages.regenerateTitle}/>}
                message={<FormattedMessage {...messages.regenerateMessage}/>}
                confirmButtonText={<FormattedMessage {...messages.confirmRegenerate}/>}
                modalClass='integrations-backstage-modal'
                show={confirmingRegenerate}
                onConfirm={regenerate}
                onCancel={() => setConfirmingRegenerate(false)}
            />
        </>
    );
}
