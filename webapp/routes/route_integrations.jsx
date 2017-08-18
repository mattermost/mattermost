// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
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
                        System.import('components/integrations/components/add_incoming_webhook').then(RouteUtils.importComponentSuccess(callback));
                    }
                },
                {
                    path: 'edit',
                    getComponents: (location, callback) => {
                        System.import('components/integrations/components/edit_incoming_webhook').then(RouteUtils.importComponentSuccess(callback));
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
                        System.import('components/integrations/components/add_outgoing_webhook').then(RouteUtils.importComponentSuccess(callback));
                    }
                },
                {
                    path: 'edit',
                    getComponents: (location, callback) => {
                        System.import('components/integrations/components/edit_outgoing_webhook').then(RouteUtils.importComponentSuccess(callback));
                    }
                }
            ]
        },
        {
            path: 'commands',
            getComponents: (location, callback) => {
                System.import('components/integrations/components/commands_container').then(RouteUtils.importComponentSuccess(callback));
            },
            indexRoute: {onEnter: (nextState, replace) => replace(nextState.location.pathname + '/installed')},
            childRoutes: [
                {
                    path: 'installed',
                    getComponents: (location, callback) => {
                        System.import('components/integrations/components/installed_commands').then(RouteUtils.importComponentSuccess(callback));
                    }
                },
                {
                    path: 'add',
                    getComponents: (location, callback) => {
                        System.import('components/integrations/components/add_command').then(RouteUtils.importComponentSuccess(callback));
                    }
                },
                {
                    path: 'edit',
                    getComponents: (location, callback) => {
                        System.import('components/integrations/components/edit_command').then(RouteUtils.importComponentSuccess(callback));
                    }
                },
                {
                    path: 'confirm',
                    getComponents: (location, callback) => {
                        System.import('components/integrations/components/confirm_integration').then(RouteUtils.importComponentSuccess(callback));
                    }
                }
            ]
        },
        {
            path: 'oauth2-apps',
            indexRoute: {
                getComponents: (location, callback) => {
                    System.import('components/integrations/components/installed_oauth_apps').then(RouteUtils.importComponentSuccess(callback));
                }
            },
            childRoutes: [
                {
                    path: 'add',
                    getComponents: (location, callback) => {
                        System.import('components/integrations/components/add_oauth_app').then(RouteUtils.importComponentSuccess(callback));
                    }
                }
            ]
        },
        {
            path: 'confirm',
            getComponents: (location, callback) => {
                System.import('components/integrations/components/confirm_integration').then(RouteUtils.importComponentSuccess(callback));
            }
        }
    ]
};
