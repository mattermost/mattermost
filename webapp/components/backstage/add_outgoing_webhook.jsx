// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import {browserHistory} from 'react-router';

import ChannelSelect from 'components/channel_select.jsx';
import {FormattedMessage} from 'react-intl';
import FormError from 'components/form_error.jsx';
import {Link} from 'react-router';
import SpinnerButton from 'components/spinner_button.jsx';

export default class AddOutgoingWebhook extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);

        this.updateDisplayName = this.updateDisplayName.bind(this);
        this.updateDescription = this.updateDescription.bind(this);
        this.updateChannelId = this.updateChannelId.bind(this);
        this.updateTriggerWords = this.updateTriggerWords.bind(this);
        this.updateCallbackUrls = this.updateCallbackUrls.bind(this);

        this.state = {
            displayName: '',
            description: '',
            channelId: '',
            triggerWords: '',
            callbackUrls: '',
            saving: false,
            serverError: '',
            clientError: null
        };
    }

    handleSubmit(e) {
        e.preventDefault();

        if (this.state.saving) {
            return;
        }

        this.setState({
            saving: true,
            serverError: '',
            clientError: ''
        });

        if (!this.state.channelId && !this.state.triggerWords) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_outgoing_webhook.triggerWordsOrChannelRequired'
                        defaultMessage='A valid channel or a list of trigger words is required'
                    />
                )
            });

            return;
        }

        if (!this.state.callbackUrls) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_outgoing_webhook.callbackUrlsRequired'
                        defaultMessage='One or more callback URLs are required'
                    />
                )
            });

            return;
        }

        const hook = {
            channel_id: this.state.channelId,
            trigger_words: this.state.triggerWords.split('\n').map((word) => word.trim()),
            callback_urls: this.state.callbackUrls.split('\n').map((url) => url.trim()),
            display_name: this.state.displayName,
            description: this.state.description
        };

        AsyncClient.addOutgoingHook(
            hook,
            () => {
                browserHistory.push('/settings/integrations/installed');
            },
            (err) => {
                this.setState({
                    saving: false,
                    serverError: err.message
                });
            }
        );
    }

    updateDisplayName(e) {
        this.setState({
            displayName: e.target.value
        });
    }

    updateDescription(e) {
        this.setState({
            description: e.target.value
        });
    }

    updateChannelId(e) {
        this.setState({
            channelId: e.target.value
        });
    }

    updateTriggerWords(e) {
        this.setState({
            triggerWords: e.target.value
        });
    }

    updateCallbackUrls(e) {
        this.setState({
            callbackUrls: e.target.value
        });
    }

    render() {
        return (
            <div className='backstage-content row'>
                <div className='add-outgoing-webhook'>
                    <div className='backstage-header'>
                        <h1>
                            <FormattedMessage
                                id='add_outgoing_webhook.header'
                                defaultMessage='Add Outgoing Webhook'
                            />
                        </h1>
                    </div>
                </div>
                <div className='backstage-form'>
                    <form className='form-horizontal'>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-3'
                                htmlFor='displayName'
                            >
                                <FormattedMessage
                                    id='add_outgoing_webhook.displayName'
                                    defaultMessage='Display Name'
                                />
                            </label>
                            <div className='col-md-5 col-sm-9'>
                                <input
                                    id='displayName'
                                    type='text'
                                    maxLength='64'
                                    className='form-control'
                                    value={this.state.displayName}
                                    onChange={this.updateDisplayName}
                                />
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-3'
                                htmlFor='description'
                            >
                                <FormattedMessage
                                    id='add_outgoing_webhook.description'
                                    defaultMessage='Description'
                                />
                            </label>
                            <div className='col-md-5 col-sm-9'>
                                <input
                                    id='description'
                                    type='text'
                                    maxLength='128'
                                    className='form-control'
                                    value={this.state.description}
                                    onChange={this.updateDescription}
                                />
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-3'
                                htmlFor='channelId'
                            >
                                <FormattedMessage
                                    id='add_outgoing_webhook.channel'
                                    defaultMessage='Channel'
                                />
                            </label>
                            <div className='col-md-5 col-sm-9'>
                                <ChannelSelect
                                    id='channelId'
                                    value={this.state.channelId}
                                    onChange={this.updateChannelId}
                                />
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-3'
                                htmlFor='triggerWords'
                            >
                                <FormattedMessage
                                    id='add_outgoing_webhook.triggerWords'
                                    defaultMessage='Trigger Words (One Per Line)'
                                />
                            </label>
                            <div className='col-md-5 col-sm-9'>
                                <textarea
                                    id='triggerWords'
                                    rows='3'
                                    maxLength='1000'
                                    className='form-control'
                                    value={this.state.triggerWords}
                                    onChange={this.updateTriggerWords}
                                />
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-3'
                                htmlFor='callbackUrls'
                            >
                                <FormattedMessage
                                    id='add_outgoing_webhook.callbackUrls'
                                    defaultMessage='Callback URLs (One Per Line)'
                                />
                            </label>
                            <div className='col-md-5 col-sm-9'>
                                <textarea
                                    id='callbackUrls'
                                    rows='3'
                                    maxLength='1000'
                                    className='form-control'
                                    value={this.state.callbackUrls}
                                    onChange={this.updateCallbackUrls}
                                />
                            </div>
                        </div>
                        <div className='backstage-form__footer'>
                            <FormError errors={[this.state.serverError, this.state.clientError]}/>
                            <Link
                                className='btn btn-sm'
                                to={'/settings/integrations/add'}
                            >
                                <FormattedMessage
                                    id='add_outgoing_webhook.cancel'
                                    defaultMessage='Cancel'
                                />
                            </Link>
                            <SpinnerButton
                                className='btn btn-primary'
                                type='submit'
                                spinning={this.state.saving}
                                onClick={this.handleSubmit}
                            >
                                <FormattedMessage
                                    id='add_outgoing_webhook.save'
                                    defaultMessage='Save'
                                />
                            </SpinnerButton>
                        </div>
                    </form>
                </div>
            </div>
        );
    }
}
