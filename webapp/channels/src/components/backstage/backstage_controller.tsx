// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import type {ComponentType} from 'react';
import {Route, Switch} from 'react-router-dom';
import type {match} from 'react-router-dom';
import {createGlobalStyle} from 'styled-components';

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import Emoji from 'components/emoji';
import AddEmoji from 'components/emoji/add_emoji';
import Integrations from 'components/integrations';
import AddIncomingWehook from 'components/integrations/add_incoming_webhook';
import AddOauthApp from 'components/integrations/add_oauth_app';
import AddOutgoingWebhook from 'components/integrations/add_outgoing_webhook';
import Bots from 'components/integrations/bots';
import AddBot from 'components/integrations/bots/add_bot';
import CommandsContainer from 'components/integrations/commands_container';
import ConfirmIntegration from 'components/integrations/confirm_integration';
import EditIncomingWebhook from 'components/integrations/edit_incoming_webhook';
import EditOauthApp from 'components/integrations/edit_oauth_app';
import EditOutgoingWebhook from 'components/integrations/edit_outgoing_webhook';
import InstalledIncomingWebhooks from 'components/integrations/installed_incoming_webhooks';
import InstalledOauthApps from 'components/integrations/installed_oauth_apps';
import InstalledOutgoingWebhooks from 'components/integrations/installed_outgoing_webhooks';

import Pluggable from 'plugins/pluggable';

import BackstageNavbar from './components/backstage_navbar';
import BackstageSidebar from './components/backstage_sidebar';

type ExtraProps = Pick<Props, 'user' | 'team'> & {scrollToTop: () => void}

type BackstageRouteProps = {
    component: ComponentType<any>;
    extraProps: ExtraProps;
    path: string;
    exact?: boolean;
}

const BackstageRoute = ({component: Component, extraProps, ...rest}: BackstageRouteProps) => (
    <Route
        {...rest}
        render={(props) => (
            <Component
                {...extraProps}
                {...props}
            />
        )}
    />
);

type Props = {

    /**
     * Current user.
     */
    user: UserProfile;

    /**
     * Current team.
     */
    team: Team;

    /**
     * Object from react-router
     */
    match: match<{url: string}>;

    siteName?: string;
    enableCustomEmoji: boolean;
    enableIncomingWebhooks: boolean;
    enableOutgoingWebhooks: boolean;
    enableCommands: boolean;
    enableOAuthServiceProvider: boolean;
    canCreateOrDeleteCustomEmoji: boolean;
    canManageIntegrations: boolean;
}

const BackstageController = (props: Props) => {
    const listRef = useRef<HTMLDivElement>(null);

    const scrollToTop = () => {
        if (listRef.current) {
            listRef.current.scrollTop = 0;
        }
    };

    if (!props.team || !props.user) {
        return null;
    }
    const extraProps = {
        team: props.team,
        user: props.user,
        scrollToTop,
    };
    return (
        <>
            <BackstageNavbar
                team={props.team}
                siteName={props.siteName}
            />
            <div
                className='backstage-body'
                ref={listRef}
            >
                <Pluggable pluggableName='Root'/>
                <BackstageSidebar
                    team={props.team}
                    user={props.user}
                    enableCustomEmoji={props.enableCustomEmoji}
                    enableIncomingWebhooks={props.enableIncomingWebhooks}
                    enableOutgoingWebhooks={props.enableOutgoingWebhooks}
                    enableCommands={props.enableCommands}
                    enableOAuthServiceProvider={props.enableOAuthServiceProvider}
                    canCreateOrDeleteCustomEmoji={props.canCreateOrDeleteCustomEmoji}
                    canManageIntegrations={props.canManageIntegrations}
                />
                <Switch>
                    <BackstageRoute
                        extraProps={extraProps}
                        exact={true}
                        path={'/:team/integrations'}
                        component={Integrations}
                    />
                    <BackstageRoute
                        extraProps={extraProps}
                        exact={true}
                        path={`${props.match.url}/incoming_webhooks`}
                        component={InstalledIncomingWebhooks}
                    />
                    <BackstageRoute
                        extraProps={extraProps}
                        path={`${props.match.url}/incoming_webhooks/add`}
                        component={AddIncomingWehook}
                    />
                    <BackstageRoute
                        extraProps={extraProps}
                        path={`${props.match.url}/incoming_webhooks/edit`}
                        component={EditIncomingWebhook}
                    />
                    <BackstageRoute
                        extraProps={extraProps}
                        exact={true}
                        path={`${props.match.url}/outgoing_webhooks`}
                        component={InstalledOutgoingWebhooks}
                    />
                    <BackstageRoute
                        extraProps={extraProps}
                        path={`${props.match.url}/outgoing_webhooks/add`}
                        component={AddOutgoingWebhook}
                    />
                    <BackstageRoute
                        extraProps={extraProps}
                        path={`${props.match.url}/outgoing_webhooks/edit`}
                        component={EditOutgoingWebhook}
                    />
                    <BackstageRoute
                        extraProps={extraProps}
                        path={`${props.match.url}/commands`}
                        component={CommandsContainer}
                    />
                    <BackstageRoute
                        extraProps={extraProps}
                        exact={true}
                        path={`${props.match.url}/oauth2-apps`}
                        component={InstalledOauthApps}
                    />
                    <BackstageRoute
                        extraProps={extraProps}
                        path={`${props.match.url}/oauth2-apps/add`}
                        component={AddOauthApp}
                    />
                    <BackstageRoute
                        extraProps={extraProps}
                        path={`${props.match.url}/oauth2-apps/edit`}
                        component={EditOauthApp}
                    />
                    <BackstageRoute
                        extraProps={extraProps}
                        path={`${props.match.url}/confirm`}
                        component={ConfirmIntegration}
                    />
                    <BackstageRoute
                        extraProps={extraProps}
                        exact={true}
                        path={'/:team/emoji'}
                        component={Emoji}
                    />
                    <BackstageRoute
                        extraProps={extraProps}
                        path={`${props.match.url}/add`}
                        component={AddEmoji}
                    />
                    <BackstageRoute
                        extraProps={extraProps}
                        path={`${props.match.url}/bots/add`}
                        component={AddBot}
                    />
                    <BackstageRoute
                        extraProps={extraProps}
                        path={`${props.match.url}/bots/edit`}
                        component={AddBot}
                    />
                    <BackstageRoute
                        extraProps={extraProps}
                        path={`${props.match.url}/bots`}
                        component={Bots}
                    />
                </Switch>
            </div>
            <BackstageGlobalStyle/>
        </>
    );
};

export default BackstageController;

const BackstageGlobalStyle = createGlobalStyle`
    #root {
        > #global-header,
        > .team-sidebar,
        > .sidebar--right,
        > .app-bar {
            display: none;
        }
    }
`;
