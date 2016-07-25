// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Client from './client.jsx';
import TeamStore from '../stores/team_store.jsx';
import BrowserStore from '../stores/browser_store.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';

import request from 'superagent';

const HTTP_UNAUTHORIZED = 401;

class WebClientClass extends Client {
    constructor() {
        super();
        this.enableLogErrorsToConsole(true);
        TeamStore.addChangeListener(this.onTeamStoreChanged);
    }

    onTeamStoreChanged = () => {
        this.setTeamId(TeamStore.getCurrentId());
    }

    track = (category, action, label, property, value) => {
        if (global.window && global.window.analytics) {
            global.window.analytics.track(action, {category, label, property, value});
        }
    }

    trackPage = () => {
        if (global.window && global.window.analytics) {
            global.window.analytics.page();
        }
    }

    handleError = (err, res) => { // eslint-disable-line no-unused-vars
        if (err.status === HTTP_UNAUTHORIZED && res.req.url !== '/api/v3/users/login') {
            GlobalActions.emitUserLoggedOutEvent('/login');
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
                this.track('api', 'api_users_login_success', '', 'login_id', loginId);
                BrowserStore.signalLogin();

                if (success) {
                    success(data);
                }
            },
            (err) => {
                this.track('api', 'api_users_login_fail', '', 'login_id', loginId);
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
                this.track('api', 'api_users_login_success', '', 'login_id', loginId);
                BrowserStore.signalLogin();

                if (success) {
                    success(data);
                }
            },
            (err) => {
                this.track('api', 'api_users_login_fail', '', 'login_id', loginId);
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
            return success(res.body);
        });
    }
}

var WebClient = new WebClientClass();
export default WebClient;
