// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';

import BackstageHeader from 'components/backstage/components/backstage_header.jsx';
import ChannelSelect from 'components/channel_select.jsx';
import {FormattedMessage} from 'react-intl';
import FormError from 'components/form_error.jsx';
import SpinnerButton from 'components/spinner_button.jsx';
import {Link} from 'react-router/es6';

export default class AbstractIncomingWebhook extends React.Component {
    static propTypes = {

        /**
        * The current team
        */
        team: PropTypes.object.isRequired,

        /**
        * The header text to render, has id and defaultMessage
        */
        header: PropTypes.object.isRequired,

        /**
        * The footer text to render, has id and defaultMessage
        */
        footer: PropTypes.object.isRequired,

        /**
        * The server error text after a failed action
        */
        serverError: PropTypes.string.isRequired,

        /**
        * The hook used to set the initial state
        */
        initialHook: PropTypes.object,

        /**
        * The async function to run when the action button is pressed
        */
        action: PropTypes.func.isRequired
    }

    constructor(props) {
        super(props);

        this.state = this.getStateFromHook(this.props.initialHook || {});
    }

    getStateFromHook = (hook) => {
        return {
            displayName: hook.display_name || '',
            description: hook.description || '',
            channelId: hook.channel_id || '',
            saving: false,
            serverError: '',
            clientError: null
        };
    }

    handleSubmit = (e) => {
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
            channel_id: this.state.channelId,
            display_name: this.state.displayName,
            description: this.state.description
        };

        this.props.action(hook).then(() => this.setState({saving: false}));
    }

    updateDisplayName = (e) => {
        this.setState({
            displayName: e.target.value
        });
    }

    updateDescription = (e) => {
        this.setState({
            description: e.target.value
        });
    }

    updateChannelId = (e) => {
        this.setState({
            channelId: e.target.value
        });
    }

    render() {
        var headerToRender = this.props.header;
        var footerToRender = this.props.footer;

        return (
            <div className='backstage-content'>
                <BackstageHeader>
                    <Link to={`/${this.props.team.name}/integrations/incoming_webhooks`}>
                        <FormattedMessage
                            id='installed_incoming_webhooks.header'
                            defaultMessage='Incoming Webhooks'
                        />
                    </Link>
                    <FormattedMessage
                        id={headerToRender.id}
                        defaultMessage={headerToRender.defaultMessage}
                    />
                </BackstageHeader>
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
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_incoming_webhook.displayName.help'
                                        defaultMessage='Display name for your incoming webhook made of up to 64 characters.'
                                    />
                                </div>
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
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_incoming_webhook.description.help'
                                        defaultMessage='Description for your incoming webhook.'
                                    />
                                </div>
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
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_incoming_webhook.channel.help'
                                        defaultMessage='Public or private channel that receives the webhook payloads. You must belong to the private channel when setting up the webhook.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='backstage-form__footer'>
                            <FormError
                                type='backstage'
                                errors={[this.props.serverError, this.state.clientError]}
                            />
                            <Link
                                className='btn btn-sm'
                                to={`/${this.props.team.name}/integrations/incoming_webhooks`}
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
                                    id={footerToRender.id}
                                    defaultMessage={footerToRender.defaultMessage}
                                />
                            </SpinnerButton>
                        </div>
                    </form>
                </div>
            </div>
        );
    }
}
