// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import * as Utils from 'utils/utils.jsx';

import BackstageHeader from 'components/backstage/components/backstage_header.jsx';
import ChannelSelect from 'components/channel_select.jsx';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';
import FormError from 'components/form_error.jsx';
import {browserHistory, Link} from 'react-router/es6';
import SpinnerButton from 'components/spinner_button.jsx';

export default class AddIncomingWebhook extends React.Component {
    static get propTypes() {
        return {
            team: React.propTypes.object.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.renderDone = this.renderDone.bind(this);
        this.handleDone = this.handleDone.bind(this);

        this.updateDisplayName = this.updateDisplayName.bind(this);
        this.updateDescription = this.updateDescription.bind(this);
        this.updateChannelId = this.updateChannelId.bind(this);

        this.state = {
            displayName: '',
            description: '',
            channelId: '',
            saving: false,
            isDone: false,
            token: '',
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
            clientError: '',
            token: ''
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
            channel_id: this.state.channelId,
            display_name: this.state.displayName,
            description: this.state.description
        };

        AsyncClient.addIncomingHook(
            hook,
            (data) => {
                this.setState({
                    isDone: true,
                    token: data.id
                });
            },
            (err) => {
                this.setState({
                    saving: false,
                    serverError: err.message
                });
            }
        );
    }

    handleDone() {
        browserHistory.push('/' + this.props.team.name + '/integrations/incoming_webhooks');
        this.setState({
            isDone: false,
            token: ''
        });
    }

    renderDone() {
        return (
            <div>
                <div className='backstage-list__help'>
                    <FormattedHTMLMessage
                        id='add_incoming_webhook.doneHelp'
                        defaultMessage='Your incoming webhook has been set up. Please send data to the following URL (see <a href="https://docs.mattermost.com/developer/webhooks-incoming.html">documentation</a> for further details).'
                    />
                </div>
                <div className='backstage-list__help'>
                    <FormattedMessage
                        id='add_incoming_webhook.url'
                        defaultMessage='URL: {url}'
                        values={{
                            url: Utils.getWindowLocationOrigin() + '/hooks/' + this.state.token
                        }}
                    />
                </div>
                <div className='backstage-list__help'>
                    <SpinnerButton
                        className='btn btn-primary'
                        type='submit'
                        onClick={this.handleDone}
                    >
                        <FormattedMessage
                            id='add_incoming_webhook.done'
                            defaultMessage='Done'
                        />
                    </SpinnerButton>
                </div>
            </div>
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

    render() {
        let content = null;
        if (this.state.isDone) {
            content = this.renderDone();
        } else {
            content = (
                <div className='backstage-form'>
                    <form
                        className='form-horizontal'
                        onSubmit={this.handleSubmit}
                    >
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='displayName'
                            >
                                <FormattedMessage
                                    id='add_incoming_webhook.displayName'
                                    defaultMessage='Display Name'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
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
                                className='control-label col-sm-4'
                                htmlFor='description'
                            >
                                <FormattedMessage
                                    id='add_incoming_webhook.description'
                                    defaultMessage='Description'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
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
                                className='control-label col-sm-4'
                                htmlFor='channelId'
                            >
                                <FormattedMessage
                                    id='add_incoming_webhook.channel'
                                    defaultMessage='Channel'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <ChannelSelect
                                    id='channelId'
                                    value={this.state.channelId}
                                    onChange={this.updateChannelId}
                                    selectOpen={true}
                                    selectPrivate={true}
                                />
                            </div>
                        </div>
                        <div className='backstage-form__footer'>
                            <FormError
                                type='backstage'
                                errors={[this.state.serverError, this.state.clientError]}
                            />
                            <Link
                                className='btn btn-sm'
                                to={'/' + this.props.team.name + '/integrations/incoming_webhooks'}
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
            );
        }

        return (
            <div className='backstage-content'>
                <BackstageHeader>
                    <Link to={'/' + this.props.team.name + '/integrations/incoming_webhooks'}>
                        <FormattedMessage
                            id='installed_incoming_webhooks.header'
                            defaultMessage='Incoming Webhooks'
                        />
                    </Link>
                    <FormattedMessage
                        id='add_incoming_webhook.header'
                        defaultMessage='Add'
                    />
                </BackstageHeader>
                {content}
            </div>
        );
    }
}
