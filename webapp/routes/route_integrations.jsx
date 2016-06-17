// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as RouteUtils from 'routes/route_utils.jsx';
import {Route, IndexRoute, Redirect} from 'react-router/es6';
import React from 'react';

import BackstageNavbar from 'components/backstage/backstage_navbar.jsx';
import BackstageSidebar from 'components/backstage/backstage_sidebar.jsx';
import Integrations from 'components/backstage/integrations.jsx';
import InstalledIncomingWebhooks from 'components/backstage/installed_incoming_webhooks.jsx';
import InstalledOutgoingWebhooks from 'components/backstage/installed_outgoing_webhooks.jsx';
import InstalledCommands from 'components/backstage/installed_commands.jsx';
import AddIncomingWebhook from 'components/backstage/add_incoming_webhook.jsx';
import AddOutgoingWebhook from 'components/backstage/add_outgoing_webhook.jsx';
import AddCommand from 'components/backstage/add_command.jsx';

export default (
    <Route path='integrations'>
        <IndexRoute
            components={{
                navbar: BackstageNavbar,
                sidebar: BackstageSidebar,
                center: Integrations
            }}
        />
        <Route path='incoming_webhooks'>
            <IndexRoute
                components={{
                    navbar: BackstageNavbar,
                    sidebar: BackstageSidebar,
                    center: InstalledIncomingWebhooks
                }}
            />
            <Route
                path='add'
                components={{
                    navbar: BackstageNavbar,
                    sidebar: BackstageSidebar,
                    center: AddIncomingWebhook
                }}
            />
        </Route>
        <Route path='outgoing_webhooks'>
            <IndexRoute
                components={{
                    navbar: BackstageNavbar,
                    sidebar: BackstageSidebar,
                    center: InstalledOutgoingWebhooks
                }}
            />
            <Route
                path='add'
                components={{
                    navbar: BackstageNavbar,
                    sidebar: BackstageSidebar,
                    center: AddOutgoingWebhook
                }}
            />
        </Route>
        <Route path='commands'>
            <IndexRoute
                components={{
                    navbar: BackstageNavbar,
                    sidebar: BackstageSidebar,
                    center: InstalledCommands
                }}
            />
            <Route
                path='add'
                components={{
                    navbar: BackstageNavbar,
                    sidebar: BackstageSidebar,
                    center: AddCommand
                }}
            />
        </Route>
        <Redirect
            from='*'
            to='/error'
            query={RouteUtils.notFoundParams}
        />
    </Route>
);
