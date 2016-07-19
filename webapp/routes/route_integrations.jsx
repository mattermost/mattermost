// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as RouteUtils from 'routes/route_utils.jsx';

export default {
    path: 'integrations',
    getComponents: (location, callback) => {
        System.import('components/backstage/backstage_controller.jsx').then(RouteUtils.importComponentSuccess(callback));
    },
    indexRoute: {
        getComponents: (location, callback) => {
            System.import('components/integrations/components/integrations.jsx').then(RouteUtils.importComponentSuccess(callback));
        }
    },
    childRoutes: [
        {
            path: 'incoming_webhooks',
            indexRoute: {
                getComponents: (location, callback) => {
                    System.import('components/integrations/components/installed_incoming_webhooks.jsx').then(RouteUtils.importComponentSuccess(callback));
                }
            },
            childRoutes: [
                {
                    path: 'add',
                    getComponents: (location, callback) => {
                        System.import('components/integrations/components/add_incoming_webhook.jsx').then(RouteUtils.importComponentSuccess(callback));
                    }
                }
            ]
        },
        {
            path: 'outgoing_webhooks',
            indexRoute: {
                getComponents: (location, callback) => {
                    System.import('components/integrations/components/installed_outgoing_webhooks.jsx').then(RouteUtils.importComponentSuccess(callback));
                }
            },
            childRoutes: [
                {
                    path: 'add',
                    getComponents: (location, callback) => {
                        System.import('components/integrations/components/add_outgoing_webhook.jsx').then(RouteUtils.importComponentSuccess(callback));
                    }
                }
            ]
        },
        {
            path: 'commands',
            indexRoute: {
                getComponents: (location, callback) => {
                    System.import('components/integrations/components/installed_commands.jsx').then(RouteUtils.importComponentSuccess(callback));
                }
            },
            childRoutes: [
                {
                    path: 'add',
                    getComponents: (location, callback) => {
                        System.import('components/integrations/components/add_command.jsx').then(RouteUtils.importComponentSuccess(callback));
                    }
                }
            ]
        },
        {
            path: 'oauth2-apps',
            indexRoute: {
                getComponents: (location, callback) => {
                    System.import('components/integrations/components/installed_oauth_apps.jsx').then(RouteUtils.importComponentSuccess(callback));
                }
            },
            childRoutes: [
                {
                    path: 'add',
                    getComponents: (location, callback) => {
                        System.import('components/integrations/components/add_oauth_app.jsx').then(RouteUtils.importComponentSuccess(callback));
                    }
                }
            ]
        }
    ]
};
