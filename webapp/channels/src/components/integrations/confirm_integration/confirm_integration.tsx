// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {defineMessages, FormattedMessage} from 'react-intl';
import {Link, useHistory} from 'react-router-dom';

import type {Bot} from '@mattermost/types/bots';
import type {Command, IncomingWebhook, OAuthApp, OutgoingOAuthConnection, OutgoingWebhook} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import BackstageHeader from 'components/backstage/components/backstage_header';
import CopyText from 'components/copy_text';
import ExternalLink from 'components/external_link';

import {Constants, DeveloperLinks, ErrorPageTypes} from 'utils/constants';
import {getSiteURL} from 'utils/url';

type Props = {
    team: Team;
    location: {search: string};
    commands: IDMappedObjects<Command>;
    oauthApps: IDMappedObjects<OAuthApp>;
    incomingHooks: IDMappedObjects<IncomingWebhook>;
    outgoingHooks: IDMappedObjects<OutgoingWebhook>;
    bots: Record<string, Bot>;
    outgoingOAuthConnections: Record<string, OutgoingOAuthConnection>;
}

const ConfirmIntegration = ({team, location, commands, oauthApps, incomingHooks, outgoingHooks, bots, outgoingOAuthConnections}: Props): JSX.Element | null => {
    const history = useHistory();

    const type = (new URLSearchParams(location.search)).get('type') || '';
    const id = (new URLSearchParams(location.search)).get('id') || '';

    useEffect(() => {
        window.addEventListener('keypress', handleKeyPress);

        return () => {
            window.removeEventListener('keypress', handleKeyPress);
        };
    });

    const handleKeyPress = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            history.push('/' + team.name + '/integrations/' + type);
        }
    };

    let headerText: JSX.Element;
    let helpText: JSX.Element | JSX.Element[];
    let tokenText: JSX.Element;

    const command = commands[id];
    const incomingHook = incomingHooks[id];
    const outgoingHook = outgoingHooks[id];
    const oauthApp = oauthApps[id];
    const outgoingOAuthConnection = outgoingOAuthConnections[id];
    const bot = bots[id];

    if (type === Constants.Integrations.COMMAND && command) {
        const commandToken = command.token;

        headerText = (
            <FormattedMessage
                id='slash_commands.header'
                defaultMessage='Slash Commands'
            />
        );
        helpText = (
            <p>
                <FormattedMessage
                    id='add_command.doneHelp'
                    defaultMessage='Your slash command is set up. The following token will be sent in the outgoing payload. Please use it to verify the request came from your Mattermost team (details at <link>Slash Commands</link>).'
                    values={{
                        link: (msg: string) => (
                            <ExternalLink
                                href={DeveloperLinks.SETUP_CUSTOM_SLASH_COMMANDS}
                                location='confirm_integration'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                />
            </p>
        );
        tokenText = (
            <p className='word-break--all'>
                <FormattedMessage
                    id='add_command.token'
                    defaultMessage='<b>Token</b>: {token}'
                    values={{
                        token: commandToken,
                        b: (chunks: string) => <b>{chunks}</b>,
                    }}
                />
                <CopyText
                    label={messages.copyToken}
                    value={commandToken}
                />
            </p>
        );
    } else if (type === Constants.Integrations.INCOMING_WEBHOOK && incomingHook) {
        const incomingHookToken = getSiteURL() + '/hooks/' + incomingHook.id;

        headerText = (
            <FormattedMessage
                id={'incoming_webhooks.header'}
                defaultMessage='Incoming Webhooks'
            />
        );
        helpText = (
            <p>
                <FormattedMessage
                    id='add_incoming_webhook.doneHelp'
                    defaultMessage='Your incoming webhook is set up. Please send data to the following URL (details at <link>Incoming Webhooks</link>).'
                    values={{
                        link: (msg: string) => (
                            <ExternalLink
                                href={DeveloperLinks.SETUP_INCOMING_WEBHOOKS}
                                location='confirm_integration'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                />
            </p>
        );
        tokenText = (
            <p className='word-break--all'>
                <FormattedMessage
                    id='add_incoming_webhook.url'
                    defaultMessage='<b>URL</b>: {url}'
                    values={{
                        url: '`' + incomingHookToken + '`',
                        b: (chunks: string) => <b>{chunks}</b>,
                    }}
                />
                <CopyText
                    label={messages.copyToken}
                    value={incomingHookToken}
                />
            </p>
        );
    } else if (type === Constants.Integrations.OUTGOING_WEBHOOK && outgoingHook) {
        const outgoingHookToken = outgoingHook.token;

        headerText = (
            <FormattedMessage
                id={'add_outgoing_webhook.header'}
                defaultMessage='Outgoing Webhooks'
            />
        );
        helpText = (
            <p>
                <FormattedMessage
                    id='add_outgoing_webhook.doneHelp'
                    defaultMessage='Your outgoing webhook is set up. The following token will be sent in the outgoing payload. Please use it to verify that the request came from your Mattermost team (details at <link>Outgoing Webhooks</link>).'
                    values={{
                        link: (msg: string) => (
                            <ExternalLink
                                href={DeveloperLinks.SETUP_OUTGOING_WEBHOOKS}
                                location='confirm_integration'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                />
            </p>
        );
        tokenText = (
            <p className='word-break--all'>
                <FormattedMessage
                    id='add_outgoing_webhook.token'
                    defaultMessage='<b>Token</b>: {token}'
                    values={{
                        token: outgoingHookToken,
                        b: (chunks: string) => <b>{chunks}</b>,
                    }}
                />
                <CopyText
                    label={messages.copyToken}
                    value={outgoingHookToken}
                />
            </p>
        );
    } else if (type === Constants.Integrations.OAUTH_APP && oauthApp) {
        const oauthAppToken = oauthApp.id;
        const oauthAppSecret = oauthApp.client_secret;

        headerText = (
            <FormattedMessage
                id={'installed_oauth2_apps.header'}
                defaultMessage='OAuth 2.0 Applications'
            />
        );

        helpText = [];
        helpText.push(
            <p key='add_oauth_app.doneHelp'>
                <FormattedMessage
                    id='add_oauth_app.doneHelp'
                    defaultMessage='Your OAuth 2.0 application is set up. Please use the following Client ID and Client Secret when requesting authorization for your application (details at <link>oAuth 2 Applications</link>).'
                    values={{
                        link: (msg: string) => (
                            <ExternalLink
                                href={DeveloperLinks.SETUP_OAUTH2}
                                location='confirm_integration'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                />
            </p>,
        );
        helpText.push(
            <p key='add_oauth_app.clientId'>
                <FormattedMessage
                    id='add_oauth_app.clientId'
                    defaultMessage='<b>Client ID</b>: {id}'
                    values={{
                        id: oauthAppToken,
                        b: (chunks: string) => <b>{chunks}</b>,
                    }}
                />
                <CopyText
                    label={messages.copyClientId}
                    value={oauthAppToken}
                />
                <br/>
                <FormattedMessage
                    id='add_oauth_app.clientSecret'
                    defaultMessage='<b>Client Secret</b>: {secret}'
                    values={{
                        secret: oauthAppSecret,
                        b: (chunks: string) => <b>{chunks}</b>,
                    }}
                />
                <CopyText
                    label={messages.copyClientSecret}
                    value={oauthAppSecret}
                />
            </p>,
        );

        helpText.push(
            <p key='add_oauth_app.doneUrlHelp'>
                <FormattedMessage
                    id='add_oauth_app.doneUrlHelp'
                    defaultMessage='Here are your authorized redirect URLs.'
                />
            </p>,
        );

        tokenText = (
            <p className='word-break--all'>
                <FormattedMessage
                    id='add_oauth_app.url'
                    defaultMessage='<b>URL(s)</b>: {url}'
                    values={{
                        url: oauthApp.callback_urls.join(', '),
                        b: (chunks: string) => <b>{chunks}</b>,
                    }}
                />
            </p>
        );
    } else if (type === Constants.Integrations.OUTGOING_OAUTH_CONNECTIONS && outgoingOAuthConnection) {
        const clientId = outgoingOAuthConnection.client_id;
        const clientSecret = outgoingOAuthConnection.client_secret;
        const username = outgoingOAuthConnection.credentials_username;
        const password = outgoingOAuthConnection.credentials_password;

        headerText = (
            <FormattedMessage
                id='installed_outgoing_oauth_connections.header'
                defaultMessage='Outgoing OAuth 2.0 Connections'
            />
        );

        helpText = [];
        helpText.push(
            <p key='add_outgoing_oauth_connection.doneHelp'>
                <FormattedMessage
                    id='add_outgoing_oauth_connection.doneHelp'
                    defaultMessage='Your Outgoing OAuth 2.0 Connection is set up. When a request is sent to one of the following Audience URLs, the Client ID and Client Secret will now be used to retrieve a token from the Token URL, before sending the integration request (details at <link>Outgoing OAuth 2.0 Connections</link>).'
                    values={{
                        link: (msg: string) => (
                            <ExternalLink
                                href={DeveloperLinks.SETUP_OAUTH2} // TODO: dev docs for outgoing oauth connections feature
                                location='confirm_integration'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                />
            </p>,
        );
        helpText.push(
            <p key='add_outgoing_oauth_connection.clientId'>
                <FormattedMessage
                    id='add_outgoing_oauth_connection.clientId'
                    defaultMessage='<b>Client ID</b>: {id}'
                    values={{
                        id: clientId,
                        b: (chunks: string) => <b>{chunks}</b>,
                    }}
                />
                <br/>
                <FormattedMessage
                    id='add_outgoing_oauth_connection.clientSecret'
                    defaultMessage='<b>Client Secret</b>: \*\*\*\*\*\*\*\*'
                    values={{
                        secret: clientSecret,
                        b: (chunks: string) => <b>{chunks}</b>,
                    }}
                />
            </p>,
        );

        if (outgoingOAuthConnection.grant_type === 'password') {
            helpText.push(
                <p key='add_outgoing_oauth_connection.username'>
                    <FormattedMessage
                        id='add_outgoing_oauth_connection.username'
                        defaultMessage='<b>Username</b>: {username}'
                        values={{
                            username,
                            b: (chunks: string) => <b>{chunks}</b>,
                        }}
                    />
                    <CopyText
                        label={messages.copyUsername}
                        value={username || ''}
                    />
                    <br/>
                    <FormattedMessage
                        id='add_outgoing_oauth_connection.password'
                        defaultMessage='<b>Password</b>: {password}'
                        values={{
                            password,
                            b: (chunks: string) => <b>{chunks}</b>,
                        }}
                    />
                </p>,
            );
        }

        tokenText = (
            <>
                <p className='word-break--all'>
                    <FormattedMessage
                        id='add_outgoing_oauth_connection.token_url'
                        defaultMessage='<b>Token URL</b>: `{url}`'
                        values={{
                            url: outgoingOAuthConnection.oauth_token_url,
                            b: (chunks: string) => <b>{chunks}</b>,
                        }}
                    />
                </p>
                <p className='word-break--all'>
                    <FormattedMessage
                        id='add_outgoing_oauth_connection.audience_urls'
                        defaultMessage='<b>Audience URL(s)</b>: `{url}`'
                        values={{
                            url: outgoingOAuthConnection.audiences.join(', '),
                            b: (chunks: string) => <b>{chunks}</b>,
                        }}
                    />
                </p>
            </>
        );
    } else if (type === Constants.Integrations.BOT && bot) {
        const botToken = (new URLSearchParams(location.search)).get('token') || '';

        headerText = (
            <FormattedMessage
                id='bots.manage.header'
                defaultMessage='Bot Accounts'
            />
        );
        helpText = (
            <p>
                <FormattedMessage
                    id='bots.manage.created.text'
                    defaultMessage='Your bot account **{botname}** has been created successfully. Please use the following access token to connect to the bot (see [documentation](https://mattermost.com/pl/default-bot-accounts) for further details).'
                    values={{
                        botname: bot.display_name || bot.username,
                        b: (msg: string) => <b>{msg}</b>,
                        link: (msg: string) => (
                            <ExternalLink
                                href='https://mattermost.com/pl/default-bot-accounts'
                                location='confirm_integration'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                />
            </p>
        );
        tokenText = (
            <p className='word-break--all'>
                <FormattedMessage
                    id='add_outgoing_webhook.token'
                    defaultMessage='<b>Token</b>: {token}'
                    values={{
                        token: botToken,
                        b: (chunks: string) => <b>{chunks}</b>,
                    }}
                />
                <CopyText
                    label={messages.copyToken}
                    value={botToken}
                />
                <br/>
                <br/>
                <FormattedMessage
                    id='add_outgoing_webhook.token.message'
                    defaultMessage='Make sure to add this bot account to teams and channels you want it to interact in. See <link>documentation</link> to learn more.'
                    values={{
                        link: (msg: string) => (
                            <ExternalLink
                                href='https://mattermost.com/pl/default-bot-accounts'
                                location='confirm_integration'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                />
            </p>
        );
    } else {
        history.replace(`/error?type=${ErrorPageTypes.PAGE_NOT_FOUND}`);
        return null;
    }

    return (
        <div className='backstage-content row'>
            <BackstageHeader>
                <Link to={'/' + team.name + '/integrations/' + type}>
                    {headerText}
                </Link>
                <FormattedMessage
                    id='integrations.add'
                    defaultMessage='Add'
                />
            </BackstageHeader>
            <div className='backstage-form backstage-form__confirmation'>
                <h4
                    className='backstage-form__title'
                    id='formTitle'
                >
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
                        to={'/' + team.name + '/integrations/' + type}
                        id='doneButton'
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
};

const messages = defineMessages({
    copyClientId: {
        id: 'integrations.copy_client_id',
        defaultMessage: 'Copy Client Id',
    },
    copyClientSecret: {
        id: 'integrations.copy_client_secret',
        defaultMessage: 'Copy Client Secret',
    },
    copyToken: {
        id: 'integrations.copy_token',
        defaultMessage: 'Copy Token',
    },
    copyUsername: {
        id: 'integrations.copy_username',
        defaultMessage: 'Copy Username',
    },
});

export default ConfirmIntegration;
