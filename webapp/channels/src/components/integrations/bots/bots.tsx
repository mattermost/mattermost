// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Bot as BotType} from '@mattermost/types/bots';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile, UserAccessToken} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import BackstageList from 'components/backstage/components/backstage_list';
import ExternalLink from 'components/external_link';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import Constants from 'utils/constants';
import {getSiteURL} from 'utils/url';
import * as Utils from 'utils/utils';

import Bot, {matchesFilter} from './bot';

type Props = {

    /**
    *  Map from botUserId to bot.
    */
    bots: Record<string, BotType>;

    /**
     * List of bot IDs managed by the app framework
     */
    appsBotIDs: string[];

    /**
     * Whether apps framework is enabled
     */
    appsEnabled: boolean;

    /**
    *  Map from botUserId to accessTokens.
    */
    accessTokens?: RelationOneToOne<UserProfile, Record<string, UserAccessToken>>;

    /**
    *  Map from botUserId to owner.
    */
    owners: Record<string, UserProfile>;

    /**
    *  Map from botUserId to user.
    */
    users: Record<string, UserProfile>;
    createBots?: boolean;

    actions: {

        /**
         * Ensure we have bot accounts
         */
        loadBots: (page?: number, perPage?: number) => Promise<{data: BotType[]; error?: Error}>;

        /**
        * Load access tokens for bot accounts
        */
        getUserAccessTokensForUser: (userId: string, page?: number, perPage?: number) => void;

        /**
        * Access token managment
        */
        createUserAccessToken: (userId: string, description: string) => Promise<{
            data: {token: string; description: string; id: string; is_active: boolean} | null;
            error?: Error;
        }>;

        revokeUserAccessToken: (tokenId: string) => Promise<{data: string; error?: Error}>;
        enableUserAccessToken: (tokenId: string) => Promise<{data: string; error?: Error}>;
        disableUserAccessToken: (tokenId: string) => Promise<{data: string; error?: Error}>;

        /**
        * Load owner of bot account
        */
        getUser: (userId: string) => void;

        /**
        * Disable a bot
        */
        disableBot: (userId: string) => Promise<ActionResult>;

        /**
        * Enable a bot
        */
        enableBot: (userId: string) => Promise<ActionResult>;

        /**
         * Load bot IDs managed by the apps
         */
        fetchAppsBotIDs: () => Promise<ActionResult>;
    };

    /**
    *  Only used for routing since backstage is team based.
    */
    team: Team;
}

type State = {
    loading: boolean;
}

export default class Bots extends React.PureComponent<Props, State> {
    public constructor(props: Props) {
        super(props);

        this.state = {
            loading: true,
        };
    }

    public componentDidMount(): void {
        this.props.actions.loadBots(
            Constants.Integrations.START_PAGE_NUM,
            parseInt(Constants.Integrations.PAGE_SIZE, 10),
        ).then(
            (result) => {
                if (result.data) {
                    const promises = [];

                    for (const bot of result.data) {
                        // We don't need to wait for this and we need to accept failure in the case where bot.owner_id is a plugin id
                        this.props.actions.getUser(bot.owner_id);

                        // We want to wait for these.
                        promises.push(this.props.actions.getUser(bot.user_id));
                        promises.push(this.props.actions.getUserAccessTokensForUser(bot.user_id));
                    }

                    Promise.all(promises).then(() => {
                        this.setState({loading: false});
                    });
                }
            },
        );
        if (this.props.appsEnabled) {
            this.props.actions.fetchAppsBotIDs();
        }
    }

    DisabledSection(props: {hasDisabled: boolean; disabledBots: JSX.Element[]; filter?: string}): JSX.Element | null {
        if (!props.hasDisabled) {
            return null;
        }
        const botsToDisplay = React.Children.map(props.disabledBots, (child) => {
            return React.cloneElement(child, {filter: props.filter});
        });
        return (
            <React.Fragment>
                <div className='bot-disabled'>
                    <FormattedMessage
                        id='bots.disabled'
                        defaultMessage='Disabled'
                    />
                </div>
                <div className='bot-list__disabled'>
                    {botsToDisplay}
                </div>
            </React.Fragment>
        );
    }

    EnabledSection(props: {enabledBots: JSX.Element[]; filter?: string}): JSX.Element {
        const botsToDisplay = React.Children.map(props.enabledBots, (child) => {
            return React.cloneElement(child, {filter: props.filter});
        });
        return (
            <div>
                {botsToDisplay}
            </div>
        );
    }

    botToJSX = (bot: BotType): JSX.Element => {
        return (
            <Bot
                key={bot.user_id}
                bot={bot}
                owner={this.props.owners[bot.user_id]}
                user={this.props.users[bot.user_id]}
                accessTokens={(this.props.accessTokens && this.props.accessTokens[bot.user_id]) || {}}
                actions={this.props.actions}
                team={this.props.team}
                fromApp={this.props.appsBotIDs.includes(bot.user_id)}
            />
        );
    };

    bots = (filter?: string): Array<boolean | JSX.Element> => {
        const bots = Object.values(this.props.bots).sort((a, b) => a.username.localeCompare(b.username));
        const match = (bot: BotType) => matchesFilter(bot, filter, this.props.owners[bot.user_id]);
        const enabledBots = bots.filter((bot) => bot.delete_at === 0).filter(match).map(this.botToJSX);
        const disabledBots = bots.filter((bot) => bot.delete_at > 0).filter(match).map(this.botToJSX);
        const sections = (
            <div key='sections'>
                <this.EnabledSection
                    enabledBots={enabledBots}
                />
                <this.DisabledSection
                    hasDisabled={disabledBots.length > 0}
                    disabledBots={disabledBots}
                />
            </div>
        );

        return [sections, enabledBots.length > 0 || disabledBots.length > 0];
    };

    public render(): JSX.Element {
        return (
            <BackstageList
                header={
                    <FormattedMessage
                        id='bots.manage.header'
                        defaultMessage='Bot Accounts'
                    />
                }
                addText={this.props.createBots &&
                    <FormattedMessage
                        id='bots.manage.add'
                        defaultMessage='Add Bot Account'
                    />
                }
                addLink={'/' + this.props.team.name + '/integrations/bots/add'}
                addButtonId='addBotAccount'
                emptyText={
                    <FormattedMessage
                        id='bots.manage.empty'
                        defaultMessage='No bot accounts found'
                    />
                }
                emptyTextSearch={
                    <FormattedMarkdownMessage
                        id='bots.manage.emptySearch'
                        defaultMessage='No bot accounts match **{searchTerm}**'
                    />
                }
                helpText={
                    <React.Fragment>
                        <FormattedMessage
                            id='bots.manage.help1'
                            defaultMessage='Use {botAccounts} to integrate with Mattermost through plugins or the API. Bot accounts are available to everyone on your server. '
                            values={{
                                botAccounts: (
                                    <ExternalLink
                                        href='https://mattermost.com/pl/default-bot-accounts'
                                        location='bots'
                                    >
                                        <FormattedMessage
                                            id='bots.manage.bot_accounts'
                                            defaultMessage='Bot Accounts'
                                        />
                                    </ExternalLink>
                                ),
                            }}
                        />
                        <FormattedMarkdownMessage
                            id='bots.manage.help2'
                            defaultMessage={'Enable bot account creation in the [System Console]({siteURL}/admin_console/integrations/bot_accounts).'}
                            values={{
                                siteURL: getSiteURL(),
                            }}
                        />
                    </React.Fragment>
                }
                searchPlaceholder={Utils.localizeMessage('bots.manage.search', 'Search Bot Accounts')}
                loading={this.state.loading}
            >
                {this.bots}
            </BackstageList>
        );
    }
}
