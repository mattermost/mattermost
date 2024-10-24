// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ChangeEvent} from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import LocalizedPlaceholderTextarea from 'components/localized_placeholder_textarea';
import SettingItemMax from 'components/setting_item_max';

const MESSAGE_MAX_LENGTH = 200;

type Props = {
    autoResponderActive: boolean;
    autoResponderMessage: string;
    updateSection: (section: string) => void;
    setParentState: (key: string, value: string | boolean) => void;
    submit: () => void;
    saving: boolean;
    error?: string;
}

export default class ManageAutoResponder extends React.PureComponent<Props> {
    handleAutoResponderChecked = (e: ChangeEvent<HTMLInputElement>) => {
        this.props.setParentState('autoResponderActive', e.target.checked);
    };

    onMessageChanged = (e: ChangeEvent<HTMLTextAreaElement>) => {
        this.props.setParentState('autoResponderMessage', e.target.value);
    };

    render() {
        const {
            autoResponderActive,
            autoResponderMessage,
        } = this.props;

        let serverError;
        if (this.props.error) {
            serverError = <label className='has-error'>{this.props.error}</label>;
        }

        const inputs = [];

        const activeToggle = (
            <div
                id='autoResponderCheckbox'
                key='autoResponderCheckbox'
                className='checkbox'
            >
                <label>
                    <input
                        id='autoResponderActive'
                        type='checkbox'
                        checked={autoResponderActive}
                        onChange={this.handleAutoResponderChecked}
                    />
                    <FormattedMessage
                        id='user.settings.notifications.autoResponderEnabled'
                        defaultMessage='Enabled'
                    />
                </label>
            </div>
        );

        const message = (
            <div
                id='autoResponderMessage'
                key='autoResponderMessage'
            >
                <div className='pt-2'>
                    <LocalizedPlaceholderTextarea
                        style={{resize: 'none'}}
                        id='autoResponderMessageInput'
                        className='form-control'
                        rows={5}
                        placeholder={defineMessage({id: 'user.settings.notifications.autoResponderPlaceholder', defaultMessage: 'Message'})}
                        value={autoResponderMessage}
                        maxLength={MESSAGE_MAX_LENGTH}
                        onChange={this.onMessageChanged}
                    />
                    {serverError}
                </div>
            </div>
        );

        inputs.push(activeToggle);
        if (autoResponderActive) {
            inputs.push(message);
        }
        inputs.push((
            <div
                key='autoResponderHint'
                className='mt-5'
            >
                <FormattedMessage
                    id='user.settings.notifications.autoResponderHint'
                    defaultMessage='Set a custom message that will be automatically sent in response to Direct Messages. Mentions in Public and Private Channels will not trigger the automated reply. Enabling Automatic Replies sets your status to Out of Office and disables email and push notifications.'
                />
            </div>
        ));

        return (
            <SettingItemMax
                title={
                    <FormattedMessage
                        id='user.settings.notifications.autoResponder'
                        defaultMessage='Automatic direct message replies'
                    />
                }
                shiftEnter={true}
                submit={this.props.submit}
                saving={this.props.saving}
                inputs={inputs}
                updateSection={this.props.updateSection}
            />
        );
    }
}
