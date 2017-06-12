// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Client from './client.jsx';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';
import BrowserStore from 'stores/browser_store.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import {reconnect} from 'actions/websocket_actions.jsx';

import request from 'superagent';

const HTTP_UNAUTHORIZED = 401;

const mfaPaths = [
    '/mfa/setup',
    '/mfa/confirm'
];

class WebClientClass extends Client {
    constructor() {
        super();
        this.enableLogErrorsToConsole(true);
        this.hasInternetConnection = true;
        TeamStore.addChangeListener(this.onTeamStoreChanged.bind(this));
    }

    onTeamStoreChanged() {
        this.setTeamId(TeamStore.getCurrentId());
    }
    trackEvent(category, event, props) {
        if (global.window && global.window.analytics) {
            const properties = Object.assign({category, type: event, user_actual_id: UserStore.getCurrentId()}, props);
            const options = {
                context: {
                    ip: '0.0.0.0'
                },
                page: {
                    path: '',
                    referrer: '',
                    search: '',
                    title: '',
                    url: ''
                },
                anonymousId: '00000000000000000000000000'
            };
            global.window.analytics.track('event', properties, options);
        }
    }

    handleError(err, res) {
        if (res && res.body && res.body.id === 'api.context.mfa_required.app_error') {
            if (mfaPaths.indexOf(window.location.pathname) === -1) {
                window.location.reload();
            }
            return;
        }

        if (err.status === HTTP_UNAUTHORIZED && res.req.url !== this.getUsersRoute() + '/login') {
            GlobalActions.emitUserLoggedOutEvent('/login');
        }

        if (err.status == null) {
            this.hasInternetConnection = false;
        }
    }

    handleSuccess = (res) => { // eslint-disable-line no-unused-vars
        if (res && !this.hasInternetConnection) {
            reconnect();
            this.hasInternetConnection = true;
        }
    }

    // not sure why but super.login doesn't work if using an () => arrow functions.
    // I think this might be a webpack issue.
    webLogin(loginId, password, token, success, error) {
        this.login(
            loginId,
            password,
            token,
            (data) => {
                this.trackEvent('api', 'api_users_login_success');
                BrowserStore.signalLogin();

                if (success) {
                    success(data);
                }
            },
            (err) => {
                this.trackEvent('api', 'api_users_login_fail');
                if (error) {
                    error(err);
                }
            }
        );
    }

    webLoginByLdap(loginId, password, token, success, error) {
        this.loginByLdap(
            loginId,
            password,
            token,
            (data) => {
                this.trackEvent('api', 'api_users_login_success');
                this.trackEvent('api', 'api_users_login_ldap_success');
                BrowserStore.signalLogin();

                if (success) {
                    success(data);
                }
            },
            (err) => {
                this.trackEvent('api', 'api_users_login_fail');
                this.trackEvent('api', 'api_users_login_ldap_fail');
                if (error) {
                    error(err);
                }
            }
        );
    }

    getYoutubeVideoInfo(googleKey, videoId, success, error) {
        request.get('https://www.googleapis.com/youtube/v3/videos').
        query({part: 'snippet', id: videoId, key: googleKey}).
        end((err, res) => {
            if (err) {
                return error(err);
            }

            if (!res.body) {
                console.error('Missing response body for getYoutubeVideoInfo'); // eslint-disable-line no-console
            }

            return success(res.body);
        });
    }

    uploadFileV4(file, filename, channelId, clientId, success, error) {
        return request.
            post(`${this.url}/api/v4/files`).
            set(this.defaultHeaders).
            attach('files', file, filename).
            field('channel_id', channelId).
            field('client_ids', clientId).
            accept('application/json').
            end(this.handleResponse.bind(this, 'uploadFile', success, error));
    }
}

var WebClient = new WebClientClass();
export default WebClient;
