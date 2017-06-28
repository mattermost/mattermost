// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';

import BackstageHeader from 'components/backstage/components/backstage_header.jsx';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';
import {Link, browserHistory} from 'react-router/es6';

import UserStore from 'stores/user_store.jsx';
import IntegrationStore from 'stores/integration_store.jsx';

import Constants from 'utils/constants.jsx';

export default class ConfirmIntegration extends React.Component {
    static get propTypes() {
        return {
            team: PropTypes.object,
            location: PropTypes.object,
            commands: PropTypes.object,
            loading: PropTypes.bool
        };
    }

    constructor(props) {
        super(props);

        this.handleIntegrationChange = this.handleIntegrationChange.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);

        const userId = UserStore.getCurrentId();

        this.state = {
            type: this.props.location.query.type,
            id: this.props.location.query.id,
            oauthApps: IntegrationStore.getOAuthApps(userId),
            loading: !IntegrationStore.hasReceivedOAuthApps(userId)
        };
    }

    componentDidMount() {
        IntegrationStore.addChangeListener(this.handleIntegrationChange);
        window.addEventListener('keypress', this.handleKeyPress);
    }

    componentWillUnmount() {
        IntegrationStore.removeChangeListener(this.handleIntegrationChange);
        window.removeEventListener('keypress', this.handleKeyPress);
    }

    handleIntegrationChange() {
        const userId = UserStore.getCurrentId();

        this.setState({
            oauthApps: IntegrationStore.getOAuthApps(userId),
            loading: !IntegrationStore.hasReceivedOAuthApps(userId)
        });
    }

    handleKeyPress(e) {
        if (e.key === 'Enter') {
            browserHistory.push('/' + this.props.team.name + '/integrations/' + this.state.type);
        }
    }

    render() {
        let headerText = null;
        let helpText = null;
        let tokenText = null;

        if (this.props.loading === true) {
            return (<div/>);
        }

        if (this.state.type === Constants.Integrations.COMMAND) {
            headerText = (
                <FormattedMessage
                    id={'installed_commands.header'}
                    defaultMessage='Slash Commands'
                />
            );
            helpText = (
                <p>
                    <FormattedHTMLMessage
                        id='add_command.doneHelp'
                        defaultMessage='Your slash command has been set up. The following token will be sent in the outgoing payload. Please use it to verify the request came from your Mattermost team (see <a href="https://docs.mattermost.com/developer/slash-commands.html">documentation</a> for further details).'
                    />
                </p>
            );
            tokenText = (
                <p className='word-break--all'>
                    <FormattedHTMLMessage
                        id='add_command.token'
                        defaultMessage='<b>Token</b>: {token}'
                        values={{
                            token: this.props.commands[this.state.id].token
                        }}
                    />
                </p>
            );
        } else if (this.state.type === Constants.Integrations.INCOMING_WEBHOOK) {
            headerText = (
                <FormattedMessage
                    id={'installed_incoming_webhooks.header'}
                    defaultMessage='Incoming Webhooks'
                />
            );
            helpText = (
                <p>
                    <FormattedHTMLMessage
                        id='add_incoming_webhook.doneHelp'
                        defaultMessage='Your incoming webhook has been set up. Please send data to the following URL (see <a href=\"https://docs.mattermost.com/developer/webhooks-incoming.html\">documentation</a> for further details).'
                    />
                </p>
            );
            tokenText = (
                <p className='word-break--all'>
                    <FormattedHTMLMessage
                        id='add_incoming_webhook.url'
                        defaultMessage='<b>URL</b>: {url}'
                        values={{
                            url: window.location.origin + '/hooks/' + this.state.id
                        }}
                    />
                </p>
            );
        } else if (this.state.type === Constants.Integrations.OUTGOING_WEBHOOK) {
            headerText = (
                <FormattedMessage
                    id={'installed_outgoing_webhooks.header'}
                    defaultMessage='Outgoing Webhooks'
                />
            );
            helpText = (
                <p>
                    <FormattedHTMLMessage
                        id='add_outgoing_webhook.doneHelp'
                        defaultMessage='Your outgoing webhook has been set up. The following token will be sent in the outgoing payload. Please use it to verify the request came from your Mattermost team (see <a href=\"https://docs.mattermost.com/developer/webhooks-outgoing.html\">documentation</a> for further details).'
                    />
                </p>
            );
            tokenText = (
                <p className='word-break--all'>
                    <FormattedHTMLMessage
                        id='add_outgoing_webhook.token'
                        defaultMessage='<b>Token</b>: {token}'
                        values={{
                            token: IntegrationStore.getOutgoingWebhook(this.props.team.id, this.state.id).token
                        }}
                    />
                </p>
            );
        } else if (this.state.type === Constants.Integrations.OAUTH_APP) {
            let oauthApp = {};
            for (var i = 0; i < this.state.oauthApps.length; i++) {
                if (this.state.oauthApps[i].id === this.state.id) {
                    oauthApp = this.state.oauthApps[i];
                    break;
                }
            }

            if (oauthApp) {
                headerText = (
                    <FormattedMessage
                        id={'installed_oauth_apps.header'}
                        defaultMessage='OAuth 2.0 Applications'
                    />
                );

                helpText = [];
                helpText.push(
                    <p key='add_oauth_app.doneHelp'>
                        <FormattedHTMLMessage
                            id='add_oauth_app.doneHelp'
                            defaultMessage='Your OAuth 2.0 application has been set up. Please use the following Client ID and Client Secret when requesting authorization for your application (see <a href="https://docs.mattermost.com/developer/oauth-2-0-applications.html">documentation</a> for further details).'
                        />
                    </p>
                );
                helpText.push(
                    <p key='add_oauth_app.clientId'>
                        <FormattedHTMLMessage
                            id='add_oauth_app.clientId'
                            defaultMessage='<b>Client ID:</b> {id}'
                            values={{
                                id: this.state.id
                            }}
                        /> <br/>
                        <FormattedHTMLMessage
                            id='add_oauth_app.clientSecret'
                            defaultMessage='<b>Client Secret:</b> {secret}'
                            values={{
                                secret: oauthApp.client_secret
                            }}
                        />
                    </p>
                );

                helpText.push(
                    <p key='add_oauth_app.doneUrlHelp'>
                        <FormattedHTMLMessage
                            id='add_oauth_app.doneUrlHelp'
                            defaultMessage='The following are your authorized redirect URL(s).'
                        />
                    </p>
                );

                tokenText = (
                    <p className='word-break--all'>
                        <FormattedHTMLMessage
                            id='add_oauth_app.url'
                            defaultMessage='<b>URL(s)</b>: {url}'
                            values={{
                                url: oauthApp.callback_urls
                            }}
                        />
                    </p>
                );
            }
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
                <div className='backstage-form backstage-form__confirmation'>
                    <h4 className='backstage-form__title'>
                        <FormattedMessage
                            id='integrations.successful'
                            defaultMessage='Setup Successful'
                        />
                    </h4>
                    {helpText}
                    {tokenText}
                    <div className='backstage-form__footer'>
                        <Link
                            className='btn btn-primary'
                            type='submit'
                            to={'/' + this.props.team.name + '/integrations/' + this.state.type}
                        >
                            <FormattedMessage
                                id='integrations.done'
                                defaultMessage='Done'
                            />
                        </Link>
                    </div>
                </div>
            </div>
        );
    }
}
