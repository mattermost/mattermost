// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Checkbox} from '@mattermost/compass-ui/components/checkbox';
import {Radio} from '@mattermost/compass-ui/components/radio';

import {eventDeliveryModeMessages} from './bot_event_delivery';
import type {EventDeliveryMode, EventDeliveryState} from './bot_event_delivery';

const MODES = Object.keys(eventDeliveryModeMessages) as EventDeliveryMode[];

type Props = {
    state: EventDeliveryState;
    disabled: boolean;
    onChange: (patch: Partial<EventDeliveryState>) => void;
};

export default function BotEventDeliverySection({state, disabled, onChange}: Props) {
    if (!state.loaded) {
        return null;
    }

    return (
        <>
            <div className='row bot-profile__section'>
                <div className='col-md-5 col-sm-8 col-sm-offset-4'>
                    <strong>
                        <FormattedMessage
                            id='bot.add.event_delivery.title'
                            defaultMessage='Event delivery'
                        />
                    </strong>
                </div>
            </div>
            <div className='form-group'>
                <span
                    id='eventDeliveryModeLabel'
                    className='control-label col-sm-4'
                >
                    <FormattedMessage
                        id='bot.add.event_delivery.mode'
                        defaultMessage='Deliver events'
                    />
                </span>
                <div className='col-md-5 col-sm-8'>
                    <div
                        role='radiogroup'
                        aria-labelledby='eventDeliveryModeLabel'
                        className='backstage-form__radio-group-inline'
                    >
                        {MODES.map((mode) => (
                            <Radio
                                key={mode}
                                value={mode}
                                name='eventDeliveryMode'
                                checked={state.mode === mode}
                                disabled={disabled}
                                onChange={() => onChange({mode})}
                            >
                                <FormattedMessage {...eventDeliveryModeMessages[mode]}/>
                            </Radio>
                        ))}
                    </div>
                    <div className='form__help'>
                        <FormattedMessage
                            id='bot.add.event_delivery.mode.help'
                            defaultMessage="Send this bot's direct messages, mentions, thread replies, and reactions to an external system. Push posts each event to a callback URL; pull lets your system fetch them with the bot's access token."
                        />
                    </div>
                </div>
            </div>
            {state.mode === 'push' && (
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                        htmlFor='eventCallbackUrl'
                    >
                        <FormattedMessage
                            id='bot.add.event_delivery.callback_url'
                            defaultMessage='Callback URL'
                        />
                    </label>
                    <div className='col-md-5 col-sm-8'>
                        <input
                            id='eventCallbackUrl'
                            type='url'
                            maxLength={2048}
                            className='form-control'
                            value={state.callbackUrl}
                            disabled={disabled}
                            onChange={(e) => onChange({callbackUrl: e.target.value})}
                        />
                        <div className='form__help'>
                            <FormattedMessage
                                id='bot.add.event_delivery.callback_url.help'
                                defaultMessage='On save, Mattermost sends a verification request here. Your endpoint must echo back the challenge it receives.'
                            />
                        </div>
                    </div>
                </div>
            )}
            {state.mode !== 'none' && (
                <div className='form-group'>
                    <div className='col-md-5 col-sm-8 col-sm-offset-4'>
                        <Checkbox
                            id='eventIgnoreBotAuthors'
                            className='backstage-form__checkbox'
                            checked={state.ignoreBotAuthors}
                            disabled={disabled}
                            onChange={(e) => onChange({ignoreBotAuthors: e.target.checked})}
                        >
                            <FormattedMessage
                                id='bot.add.event_delivery.ignore_bot_authors'
                                defaultMessage='Ignore messages from other bots'
                            />
                        </Checkbox>
                    </div>
                </div>
            )}
        </>
    );
}
