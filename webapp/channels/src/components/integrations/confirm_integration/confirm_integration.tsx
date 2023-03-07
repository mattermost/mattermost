// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {Link, useHistory} from 'react-router-dom';

import {Constants, ErrorPageTypes} from 'utils/constants';
import {getSiteURL} from 'utils/url';

import {Team} from '@mattermost/types/teams';
import {Command, IncomingWebhook, OAuthApp, OutgoingWebhook} from '@mattermost/types/integrations';
import {IDMappedObjects} from '@mattermost/types/utilities';

import CopyText from 'components/copy_text';
import BackstageHeader from 'components/backstage/components/backstage_header';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import {Bot} from '@mattermost/types/bots';

type Props = {
    team: Team;
    location: {search: string};
    commands: IDMappedObjects<Command>;
    oauthApps: IDMappedObjects<OAuthApp>;
    incomingHooks: IDMappedObjects<IncomingWebhook>;
    outgoingHooks: IDMappedObjects<OutgoingWebhook>;
    bots: Record<string, Bot>;
}

const ConfirmIntegration = ({team, location, commands, oauthApps, incomingHooks, outgoingHooks, bots}: Props): JSX.Element | null => {
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
    const bot = bots[id];

    if (type === Constants.Integrations.COMMAND && command) {
        const commandToken = command.token;

        headerText = (
            <FormattedMessage
                id={'installed_commands.header'}
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
                            <a
                                href='https://developers.mattermost.com/integrate/admin-guide/admin-slash-commands/'
                                target='_blank'
                                rel='noreferrer'
                            >
                                {msg}
                            </a>
                        ),
                    }}
                />
            </p>
        );
        tokenText = (
            <p className='word-break--all'>
                <FormattedMarkdownMessage
                    id='add_command.token'
                    defaultMessage='**Token**: {token}'
                    values={{token: commandToken}}
                />
                <CopyText value={commandToken}/>
            </p>
        );
    } else if (type === Constants.Integrations.INCOMING_WEBHOOK && incomingHook) {
        const incomingHookToken = getSiteURL() + '/hooks/' + incomingHook.id;

        headerText = (
            <FormattedMessage
                id={'installed_incoming_webhooks.header'}
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
                            <a
                                href='https://developers.mattermost.com/integrate/admin-guide/admin-webhooks-incoming/'
                                target='_blank'
                                rel='noreferrer'
                            >
                                {msg}
                            </a>
                        ),
                    }}
                />
            </p>
        );
        tokenText = (
            <p className='word-break--all'>
                <FormattedMarkdownMessage
                    id='add_incoming_webhook.url'
                    defaultMessage='**URL**: {url}'
                    values={{url: '`' + incomingHookToken + '`'}}
                />
                <CopyText value={incomingHookToken}/>
            </p>
        );
    } else if (type === Constants.Integrations.OUTGOING_WEBHOOK && outgoingHook) {
        const outgoingHookToken = outgoingHook.token;

        headerText = (
            <FormattedMessage
                id={'installed_outgoing_webhooks.header'}
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
                            <a
                                href='https://developers.mattermost.com/integrate/admin-guide/admin-webhooks-outgoing/'
                                target='_blank'
                                rel='noreferrer'
                            >
                                {msg}
                            </a>
                        ),
                    }}
                />
            </p>
        );
        tokenText = (
            <p className='word-break--all'>
                <FormattedMarkdownMessage
                    id='add_outgoing_webhook.token'
                    defaultMessage='**Token**: {token}'
                    values={{token: outgoingHookToken}}
                />
                <CopyText value={outgoingHookToken}/>
            </p>
        );
    } else if (type === Constants.Integrations.OAUTH_APP && oauthApp) {
        const oauthAppToken = oauthApp.id;
        const oauthAppSecret = oauthApp.client_secret;

        headerText = (
            <FormattedMessage
                id={'installed_oauth_apps.header'}
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
                            <a
                                href='https://developers.mattermost.com/integrate/admin-guide/admin-oauth2/'
                                target='_blank'
                                rel='noreferrer'
                            >
                                {msg}
                            </a>
                        ),
                    }}
                />
            </p>,
        );
        helpText.push(
            <p key='add_oauth_app.clientId'>
                <FormattedMarkdownMessage
                    id='add_oauth_app.clientId'
                    defaultMessage='**Client ID**: {id}'
                    values={{id: oauthAppToken}}
                />
                <CopyText
                    idMessage='integrations.copy_client_id'
                    defaultMessage='Copy Client Id'
                    value={oauthAppToken}
                />
                <br/>
                <FormattedMarkdownMessage
                    id='add_oauth_app.clientSecret'
                    defaultMessage='**Client Secret**: {secret}'
                    values={{secret: oauthAppSecret}}
                />
                <CopyText
                    idMessage='integrations.copy_client_secret'
                    defaultMessage='Copy Client Secret'
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
                <FormattedMarkdownMessage
                    id='add_oauth_app.url'
                    defaultMessage='**URL(s)**: {url}'
                    values={{url: oauthApp.callback_urls.join(', ')}}
                />
            </p>
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
                        strong: (msg: string) => <strong>{msg}</strong>,
                        link: (msg: string) => (
                            <a
                                href='https://mattermost.com/pl/default-bot-accounts'
                                target='_blank'
                                rel='noreferrer'
                            >
                                {msg}
                            </a>
                        ),
                    }}
                />
            </p>
        );
        tokenText = (
            <p className='word-break--all'>
                <FormattedMarkdownMessage
                    id='add_outgoing_webhook.token'
                    defaultMessage='**Token**: {token}'
                    values={{token: botToken}}
                />
                <CopyText value={botToken}/>
                <br/>
                <br/>
                <FormattedMessage
                    id='add_outgoing_webhook.token.message'
                    defaultMessage='Make sure to add this bot account to teams and channels you want it to interact in. See <link>documentation</link> to learn more.'
                    values={{
                        link: (msg: string) => (
                            <a
                                href='https://mattermost.com/pl/default-bot-accounts'
                                target='_blank'
                                rel='noreferrer'
                            >
                                {msg}
                            </a>
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

export default ConfirmIntegration;
