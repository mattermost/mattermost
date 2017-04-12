// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as RouteUtils from 'routes/route_utils.jsx';

export default {
    path: 'help',
    indexRoute: {onEnter: (nextState, replace) => replace('/help/messaging')},
    childRoutes: [
        {
            getComponents: (location, callback) => {
                System.import('components/help/help_controller.jsx').then(RouteUtils.importComponentSuccess(callback));
            },
            childRoutes: [
                {
                    path: 'messaging',
                    indexRoute: {
                        getComponents: (location, callback) => {
                            System.import('components/help/components/messaging.jsx').then(RouteUtils.importComponentSuccess(callback));
                        }
                    }
                },
                {
                    path: 'composing',
                    indexRoute: {
                        getComponents: (location, callback) => {
                            System.import('components/help/components/composing.jsx').then(RouteUtils.importComponentSuccess(callback));
                        }
                    }
                },
                {
                    path: 'mentioning',
                    indexRoute: {
                        getComponents: (location, callback) => {
                            System.import('components/help/components/mentioning.jsx').then(RouteUtils.importComponentSuccess(callback));
                        }
                    }
                },
                {
                    path: 'formatting',
                    indexRoute: {
                        getComponents: (location, callback) => {
                            System.import('components/help/components/formatting.jsx').then(RouteUtils.importComponentSuccess(callback));
                        }
                    }
                },
                {
                    path: 'attaching',
                    indexRoute: {
                        getComponents: (location, callback) => {
                            System.import('components/help/components/attaching.jsx').then(RouteUtils.importComponentSuccess(callback));
                        }
                    }
                },
                {
                    path: 'commands',
                    indexRoute: {
                        getComponents: (location, callback) => {
                            System.import('components/help/components/commands.jsx').then(RouteUtils.importComponentSuccess(callback));
                        }
                    }
                }
            ]
        }
    ]
};
