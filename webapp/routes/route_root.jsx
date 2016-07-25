// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as RouteUtils from 'routes/route_utils.jsx';

import Root from 'components/root.jsx';

import claimAccountRoute from 'routes/route_claim.jsx';
import createTeamRoute from 'routes/route_create_team.jsx';
import teamRoute from 'routes/route_team.jsx';

import ErrorStore from 'stores/error_store.jsx';
function preLoggedIn(nextState, replace, callback) {
    ErrorStore.clearLastError();
    callback();
}

export default {
    path: '/',
    component: Root,
    getChildRoutes: RouteUtils.createGetChildComponentsFunction(
        [
            {
                getComponents: (location, callback) => {
                    System.import('components/header_footer_template.jsx').then(RouteUtils.importComponentSuccess(callback));
                },
                getChildRoutes: RouteUtils.createGetChildComponentsFunction(
                    [
                        {
                            path: 'login',
                            getComponents: (location, callback) => {
                                System.import('components/login/login_controller.jsx').then(RouteUtils.importComponentSuccess(callback));
                            }
                        },
                        {
                            path: 'reset_password',
                            getComponents: (location, callback) => {
                                System.import('components/password_reset_send_link.jsx').then(RouteUtils.importComponentSuccess(callback));
                            }
                        },
                        {
                            path: 'reset_password_complete',
                            getComponents: (location, callback) => {
                                System.import('components/password_reset_form.jsx').then(RouteUtils.importComponentSuccess(callback));
                            }
                        },
                        claimAccountRoute,
                        {
                            path: 'signup_user_complete',
                            getComponents: (location, callback) => {
                                System.import('components/signup_user_complete.jsx').then(RouteUtils.importComponentSuccess(callback));
                            }
                        },
                        {
                            path: 'should_verify_email',
                            getComponents: (location, callback) => {
                                System.import('components/should_verify_email.jsx').then(RouteUtils.importComponentSuccess(callback));
                            }
                        },
                        {
                            path: 'do_verify_email',
                            getComponents: (location, callback) => {
                                System.import('components/do_verify_email.jsx').then(RouteUtils.importComponentSuccess(callback));
                            }
                        }
                    ]
                )
            },
            {
                path: 'error',
                getComponents: (location, callback) => {
                    System.import('components/error_page.jsx').then(RouteUtils.importComponentSuccess(callback));
                }
            },
            {
                getComponents: (location, callback) => {
                    System.import('components/logged_in.jsx').then(RouteUtils.importComponentSuccess(callback));
                },
                onEnter: preLoggedIn,
                getChildRoutes: RouteUtils.createGetChildComponentsFunction(
                    [
                        {
                            path: 'admin_console',
                            getComponents: (location, callback) => {
                                System.import('components/admin_console/admin_console.jsx').then(RouteUtils.importComponentSuccess(callback));
                            },
                            indexRoute: {onEnter: (nextState, replace) => replace('/admin_console/system_analytics')},
                            getChildRoutes: (location, callback) => {
                                System.import('routes/route_admin_console.jsx').then((comp) => callback(null, comp.default));
                            }
                        },
                        {
                            getComponents: (location, callback) => {
                                System.import('components/header_footer_template.jsx').then(RouteUtils.importComponentSuccess(callback));
                            },
                            getChildRoutes: RouteUtils.createGetChildComponentsFunction(
                                [
                                    {
                                        path: 'select_team',
                                        getComponents: (location, callback) => {
                                            System.import('components/select_team/select_team.jsx').then(RouteUtils.importComponentSuccess(callback));
                                        }
                                    },
                                    createTeamRoute
                                ]
                            )
                        },
                        {
                            path: 'get_ios_app',
                            getComponents: (location, callback) => {
                                System.import('components/get_ios_app/get_ios_app.jsx').then(RouteUtils.importComponentSuccess(callback));
                            }
                        },
                        {
                            path: 'get_android_app',
                            getComponents: (location, callback) => {
                                System.import('components/get_android_app/get_android_app.jsx').then(RouteUtils.importComponentSuccess(callback));
                            }
                        },
                        teamRoute
                    ]
                )
            },
            {
                path: '*',
                onEnter: (nextState, replace) => {
                    replace({
                        pathname: 'error',
                        query: RouteUtils.notFoundParams
                    });
                }
            }
        ]
    )
};
