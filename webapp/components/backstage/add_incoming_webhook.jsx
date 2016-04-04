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

export default class AddIncomingWebhook extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);

        this.updateName = this.updateName.bind(this);
        this.updateDescription = this.updateDescription.bind(this);
        this.updateChannelId = this.updateChannelId.bind(this);

        this.state = {
            name: '',
            description: '',
            channelId: '',
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

        if (!this.state.channelId) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_incoming_webhook.channelRequired'
                        defaultMessage='A valid channel is required'
                    />
                )
            });

            return;
        }

        const hook = {
            channel_id: this.state.channelId
        };

        AsyncClient.addIncomingHook(
            hook,
            () => {
                browserHistory.push('/settings/integrations/installed');
            },
            (err) => {
                this.setState({
                    serverError: err.message
                });
            }
        );
    }

    updateName(e) {
        this.setState({
            name: e.target.value
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

    render() {
        return (
            <div className='backstage-content row'>
                <div className='add-incoming-webhook'>
                    <div className='backstage-header'>
                        <h1>
                            <FormattedMessage
                                id='add_incoming_webhook.header'
                                defaultMessage='Add Incoming Webhook'
                            />
                        </h1>
                    </div>
                </div>
                <div className='backstage-form'>
                    <form className='form-horizontal'>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-3'
                                htmlFor='name'
                            >
                                <FormattedMessage
                                    id='add_incoming_webhook.name'
                                    defaultMessage='Name'
                                />
                            </label>
                            <div className='col-md-5 col-sm-9'>
                                <input
                                    id='name'
                                    type='text'
                                    className='form-control'
                                    value={this.state.name}
                                    onChange={this.updateName}
                                />
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-3'
                                htmlFor='description'
                            >
                                <FormattedMessage
                                    id='add_incoming_webhook.description'
                                    defaultMessage='Description'
                                />
                            </label>
                            <div className='col-md-5 col-sm-9'>
                                <input
                                    id='description'
                                    type='text'
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
                                    id='add_incoming_webhook.channel'
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
                        <div className='backstage-form__footer'>
                            <FormError errors={[this.state.serverError, this.state.clientError]}/>
                            <Link
                                className='btn btn-sm'
                                to={'/settings/integrations/add'}
                            >
                                <FormattedMessage
                                    id='add_incoming_webhook.cancel'
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
                                    id='add_incoming_webhook.save'
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
