// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import BackstageHeader from 'components/backstage/components/backstage_header.jsx';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';
import {browserHistory, Link} from 'react-router/es6';
import SpinnerButton from 'components/spinner_button.jsx';

import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

export default class ConfirmIntegration extends React.Component {
    static get propTypes() {
        return {
            team: React.propTypes.object.isRequired,
            location: React.PropTypes.object
        };
    }

    constructor(props) {
        super(props);

        this.handleDone = this.handleDone.bind(this);

        this.state = {
            type: '',
            token: ''
        };
    }

    componentWillMount() {
        const type = this.props.location.query.type;
        const token = this.props.location.query.token;

        this.setState({
            type,
            token
        });
    }

    handleDone() {
        browserHistory.push('/' + this.props.team.name + '/integrations/' + this.state.type);
        this.setState({
            token: ''
        });
    }

    render() {
        let headerText = null;
        let helpText = null;
        let tokenText = null;
        if (this.state.type === Constants.Integrations.COMMAND) {
            headerText = (
                <FormattedMessage
                    id={'installed_commands.header'}
                    defaultMessage='Slash Commands'
                />
            );
            helpText = (
                <div className='backstage-list__help'>
                    <FormattedHTMLMessage
                        id='add_command.doneHelp'
                        defaultMessage='Your slash command has been set up. The following token will be sent in the outgoing payload. Please use it to verify the request came from your Mattermost team (see <a href="https://docs.mattermost.com/developer/slash-commands.html">documentation</a> for further details).'
                    />
                </div>
            );
            tokenText = (
                <div className='backstage-list__help'>
                    <FormattedMessage
                        id='add_command.token'
                        defaultMessage='Token: {token}'
                        values={{
                            token: this.state.token
                        }}
                    />
                </div>
            );
        } else if (this.state.type === Constants.Integrations.INCOMING_WEBHOOK) {
            headerText = (
                <FormattedMessage
                    id={'installed_incoming_webhooks.header'}
                    defaultMessage='Incoming Webhooks'
                />
            );
            helpText = (
                <div className='backstage-list__help'>
                    <FormattedHTMLMessage
                        id='add_incoming_webhook.doneHelp'
                        defaultMessage='Your incoming webhook has been set up. Please send data to the following URL (see <a href=\"https://docs.mattermost.com/developer/webhooks-incoming.html\">documentation</a> for further details).'
                    />
                </div>
            );
            tokenText = (
                <div className='backstage-list__help'>
                    <FormattedMessage
                        id='add_incoming_webhook.url'
                        defaultMessage='URL: {url}'
                        values={{
                            url: window.location.origin + '/hooks/' + this.state.token
                        }}
                    />
                </div>
            );
        } else if (this.state.type === Constants.Integrations.OUTGOING_WEBHOOK) {
            headerText = (
                <FormattedMessage
                    id={'installed_outgoing_webhooks.header'}
                    defaultMessage='Outgoing Webhooks'
                />
            );
            helpText = (
                <div className='backstage-list__help'>
                    <FormattedHTMLMessage
                        id='add_outgoing_webhook.doneHelp'
                        defaultMessage='Your outgoing webhook has been set up. The following token will be sent in the outgoing payload. Please use it to verify the request came from your Mattermost team (see <a href=\"https://docs.mattermost.com/developer/webhooks-outgoing.html\">documentation</a> for further details).'
                    />
                </div>
            );
            tokenText = (
                <div className='backstage-list__help'>
                    <FormattedMessage
                        id='add_outgoing_webhook.token'
                        defaultMessage='Token: {token}'
                        values={{
                            token: this.state.token
                        }}
                    />
                </div>
            );
        } else if (this.state.type === Constants.Integrations.OAUTH_APP) {
            headerText = (
                <FormattedMessage
                    id={'installed_oauth_apps.header'}
                    defaultMessage='OAuth 2.0 Applications'
                />
            );

            helpText = [];
            helpText.push(
                <div className='backstage-list__help'>
                    <FormattedMessage
                        id='add_oauth_app.doneHelp'
                        defaultMessage='Your OAuth 2.0 application has been set up. Please use the following Client ID and Client Secret when requesting authorization for your application.'
                    />
                </div>
            );
            helpText.push(
                <div className='backstage-list__help'>
                    <FormattedMessage
                        id='add_oauth_app.clientId'
                        defaultMessage='Client ID: {id}'
                        values={{
                            id: this.state.token
                        }}
                    />
                </div>
            );

            const clientSecret = this.props.location.query.secret;
            helpText.push(
                <div className='backstage-list__help'>
                    <FormattedMessage
                        id='add_oauth_app.clientSecret'
                        defaultMessage='Client Secret: {secret}'
                        values={{
                            secret: clientSecret
                        }}
                    />
                </div>
            );

            helpText.push(
                <div className='backstage-list__help'>
                    <FormattedHTMLMessage
                        id='add_oauth_app.doneUrlHelp'
                        defaultMessage='Please send data to the following URL (see <a href="https://docs.mattermost.com/developer/oauth2-applications.html">documentation</a> for further details.)'
                    />
                </div>
            );

            const urls = this.props.location.query.callback_urls;
            tokenText = (
                <div className='backstage-list__help'>
                    <FormattedMessage
                        id='add_oauth_app.url'
                        defaultMessage='URL(s): {url}'
                        values={{
                            url: urls
                        }}
                    />
                </div>
            );
        }

        return (
            <div className='backstage-content row'>
                <BackstageHeader>
                    <Link to={'/' + this.props.team.name + '/integrations/' + this.state.type}>
                        {headerText}
                    </Link>
                    <FormattedMessage
                        id='integrations.add'
                        defaultMessage='Add'
                    />
                </BackstageHeader>
                {helpText}
                {tokenText}
                <div className='backstage-list__help'>
                    <SpinnerButton
                        className='btn btn-primary'
                        type='submit'
                        onClick={this.handleDone}
                    >
                        <FormattedMessage
                            id='integrations.done'
                            defaultMessage='Done'
                        />
                    </SpinnerButton>
                </div>
            </div>
        );
    }
}
