// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {OAuthApp} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import OAuthAppsList from './oauth_apps_list';

type Props = {
    team: Team;
    users: RelationOneToOne<UserProfile, UserProfile>;

    // OAuth apps to display
    oauthApps: {
        [key: string]: OAuthApp;
    };
    loading: boolean;

    // List of IDs for apps managed by the App Framework
    appsOAuthAppIDs: string[];

    // Set if user can manage oauth
    canManageOauth: boolean;

    actions: {
        // The function to call to fetch OAuth apps
        loadOAuthAppsAndProfiles: (page?: number, perPage?: number) => Promise<ActionResult>;

        // The function to call when Regenerate Secret link is clicked
        regenOAuthAppSecret: (appId: string) => Promise<ActionResult>;

        // The function to call when Delete link is clicked
        deleteOAuthApp: (appId: string) => Promise<ActionResult>;
    };
};

type State = {
    loading: boolean;
};

export default class InstalledOAuthApps extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            loading: true,
        };
    }

    componentDidMount(): void {
        this.props.actions.loadOAuthAppsAndProfiles().then(
            () => this.setState({loading: false}),
        );
    }

    public regenOAuthAppSecret = (app: OAuthApp): void => {
        this.props.actions.regenOAuthAppSecret(app.id);
    };

    public deleteOAuthApp = (app: OAuthApp): void => {
        this.props.actions.deleteOAuthApp(app.id);
    };

    public render(): JSX.Element {
        // Convert object to array
        const oauthAppsArray = Object.values(this.props.oauthApps);

        return (
            <OAuthAppsList
                oauthApps={oauthAppsArray}
                users={this.props.users}
                team={this.props.team}
                canManageOauth={this.props.canManageOauth}
                appsOAuthAppIDs={this.props.appsOAuthAppIDs}
                onDelete={this.deleteOAuthApp}
                onRegenSecret={this.regenOAuthAppSecret}
                loading={this.state.loading}
            />
        );
    }
}
