// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Bot as BotType} from '@mattermost/types/bots';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile, UserAccessToken} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import Constants from 'utils/constants';

import BotsList from './bots_list';

type Props = {

    // Map from botUserId to bot
    bots: Record<string, BotType>;

    // List of bot IDs managed by the app framework
    appsBotIDs: string[];

    // Whether apps framework is enabled
    appsEnabled: boolean;

    // Map from botUserId to accessTokens
    accessTokens?: RelationOneToOne<UserProfile, Record<string, UserAccessToken>>;

    // Map from botUserId to owner
    owners: Record<string, UserProfile>;

    // Map from botUserId to user
    users: Record<string, UserProfile>;
    createBots?: boolean;

    actions: {

        // Ensure we have bot accounts
        loadBots: (page?: number, perPage?: number) => Promise<ActionResult<BotType[]>>;

        // Load access tokens for bot accounts
        getUserAccessTokensForUser: (userId: string, page?: number, perPage?: number) => void;

        // Access token management
        createUserAccessToken: (userId: string, description: string) => Promise<ActionResult<UserAccessToken>>;

        revokeUserAccessToken: (tokenId: string) => Promise<ActionResult>;
        enableUserAccessToken: (tokenId: string) => Promise<ActionResult>;
        disableUserAccessToken: (tokenId: string) => Promise<ActionResult>;

        // Load owner of bot account
        getUser: (userId: string) => void;

        // Disable a bot
        disableBot: (userId: string) => Promise<ActionResult>;

        // Enable a bot
        enableBot: (userId: string) => Promise<ActionResult>;

        // Load bot IDs managed by the apps
        fetchAppsBotIDs: () => Promise<ActionResult>;
    };

    // Only used for routing since backstage is team based
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
            Constants.Integrations.PAGE_SIZE,
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

    public disableBot = (bot: BotType): void => {
        this.props.actions.disableBot(bot.user_id);
    };

    public enableBot = (bot: BotType): void => {
        this.props.actions.enableBot(bot.user_id);
    };

    public createToken = async (userId: string, description: string): Promise<{data?: UserAccessToken; error?: {message: string}}> => {
        return this.props.actions.createUserAccessToken(userId, description);
    };

    public render(): JSX.Element {
        // Convert bots object to array
        const botsArray = Object.values(this.props.bots);

        return (
            <BotsList
                bots={botsArray}
                owners={this.props.owners}
                users={this.props.users}
                accessTokens={this.props.accessTokens}
                team={this.props.team}
                createBots={this.props.createBots || false}
                appsBotIDs={this.props.appsBotIDs}
                onDisable={this.disableBot}
                onEnable={this.enableBot}
                onCreateToken={this.createToken}
                loading={this.state.loading}
            />
        );
    }
}
