// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {OAuthApp} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import BackstageList from 'components/backstage/components/backstage_list';
import ExternalLink from 'components/external_link';

import {DeveloperLinks} from 'utils/constants';
import {localizeMessage} from 'utils/utils';

import InstalledOAuthApp from '../installed_oauth_app';
import {matchesFilter} from '../installed_oauth_app/installed_oauth_app';

type Props = {

    /**
    * The team data
    */
    team?: Team;

    /**
    * The oauthApps data
    */
    oauthApps: {
        [key: string]: OAuthApp;
    };

    /**
     * List of IDs for apps managed by the App Framwork
     */
    appsOAuthAppIDs: string[];

    /**
    * Set if user can manage oath
    */
    canManageOauth: boolean;

    /**
    * Whether or not OAuth applications are enabled.
    */
    enableOAuthServiceProvider: boolean;

    actions: ({

        /**
        * The function to call to fetch OAuth apps
        */
        loadOAuthAppsAndProfiles: (page?: number, perPage?: number) => Promise<ActionResult>;

        /**
        * The function to call when Regenerate Secret link is clicked
        */
        regenOAuthAppSecret: (appId: string) => Promise<ActionResult>;

        /**
        * The function to call when Delete link is clicked
        */
        deleteOAuthApp: (appId: string) => Promise<ActionResult>;
    });
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
        if (this.props.enableOAuthServiceProvider) {
            this.props.actions.loadOAuthAppsAndProfiles().then(
                () => this.setState({loading: false}),
            );
        }
    }

    deleteOAuthApp = (app: OAuthApp): void => {
        if (app && app.id) {
            this.props.actions.deleteOAuthApp(app.id);
        }
    };

    oauthAppCompare(a: OAuthApp, b: OAuthApp): number {
        let nameA = a.name.toString();
        if (!nameA) {
            nameA = localizeMessage({id: 'installed_integrations.unnamed_oauth_app', defaultMessage: 'Unnamed OAuth 2.0 Application'});
        }

        let nameB = b.name.toString();
        if (!nameB) {
            nameB = localizeMessage({id: 'installed_integrations.unnamed_oauth_app', defaultMessage: 'Unnamed OAuth 2.0 Application'});
        }

        return nameA.localeCompare(nameB);
    }

    oauthApps = (filter?: string) => Object.values(this.props.oauthApps).
        filter((app) => matchesFilter(app, filter)).
        sort(this.oauthAppCompare).
        map((app) => {
            return (
                <InstalledOAuthApp
                    key={app.id}
                    oauthApp={app}
                    onRegenerateSecret={this.props.actions.regenOAuthAppSecret}
                    onDelete={this.deleteOAuthApp}
                    team={this.props.team}
                    creatorName=''
                    fromApp={this.props.appsOAuthAppIDs.includes(app.id)}
                />
            );
        });

    render() {
        if (!this.props.team) {
            return null;
        }
        const integrationsEnabled = this.props.enableOAuthServiceProvider && this.props.canManageOauth;
        let props;
        if (integrationsEnabled) {
            props = {
                addLink: '/' + this.props.team.name + '/integrations/oauth2-apps/add',
                addText: localizeMessage({id: 'installed_oauth_apps.add', defaultMessage: 'Add OAuth 2.0 Application'}),
                addButtonId: 'addOauthApp',
            };
        }

        return (
            <BackstageList
                header={
                    <FormattedMessage
                        id='installed_oauth2_apps.header'
                        defaultMessage='OAuth 2.0 Applications'
                    />
                }
                helpText={
                    <FormattedMessage
                        id='installed_oauth_apps.help'
                        defaultMessage='Create {oauthApplications} to securely integrate bots and third-party apps with Mattermost. Visit the {appDirectory} to find available self-hosted apps.'
                        values={{
                            oauthApplications: (
                                <ExternalLink
                                    href={DeveloperLinks.SETUP_OAUTH2}
                                    location='installed_oauth_apps'
                                >
                                    <FormattedMessage
                                        id='installed_oauth_apps.help.oauthApplications'
                                        defaultMessage='OAuth 2.0 applications'
                                    />
                                </ExternalLink>
                            ),
                            appDirectory: (
                                <ExternalLink
                                    href='https://mattermost.com/marketplace/'
                                    location='installed_oauth_apps'
                                >
                                    <FormattedMessage
                                        id='installed_oauth_apps.help.appDirectory'
                                        defaultMessage='App Directory'
                                    />
                                </ExternalLink>
                            ),
                        }}
                    />
                }
                emptyText={
                    <FormattedMessage
                        id='installed_oauth_apps.empty'
                        defaultMessage='No OAuth 2.0 Applications found'
                    />
                }
                emptyTextSearch={
                    <FormattedMessage
                        id='installed_oauth_apps.emptySearch'
                        defaultMessage='No OAuth 2.0 Applications match {searchTerm}'
                    />
                }
                searchPlaceholder={localizeMessage({id: 'installed_oauth_apps.search', defaultMessage: 'Search OAuth 2.0 Applications'})}
                loading={this.state.loading}
                {...props}
            >
                {(filter: string) => {
                    const children = this.oauthApps(filter);
                    return [children, children.length > 0];
                }}
            </BackstageList>
        );
    }
}
