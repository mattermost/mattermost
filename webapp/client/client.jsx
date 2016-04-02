// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import request from 'superagent';

export default class Client {
    constructor() {
        this.teamId = '';
        this.serverVersion = '';
        this.logToConsole = false;
        this.url = '';
        this.urlVersion = '/api/v2';
        this.defaultHeaders = {
            'X-Requested-With': 'XMLHttpRequest'
        };

        this.translations = {
            connectionError: 'There appears to be a problem with your internet connection.',
            unknownError: 'We received an unexpected status code from the server.'
        };
    }

    setUrl = (url) => {
        this.url = url;
    }

    setTeamId = (id) => {
        this.teamId = id;
    }

    getTeamId = () => {
        return this.teamId;
    }

    getBaseRoute() {
        return `${this.url}${this.urlVersion}`;
    }

    getAdminRoute() {
        return `${this.url}${this.urlVersion}/admin`;
    }

    getLicenseRoute() {
        return `${this.url}${this.urlVersion}/license`;
    }

    getTeamsRoute() {
        return `${this.url}${this.urlVersion}/teams`;
    }

    getTeamNeededRoute() {
        return `${this.url}${this.urlVersion}/teams/${this.teamId}`;
    }

    getChannelsRoute() {
        return `${this.url}${this.urlVersion}/teams/${this.teamId}/channels`;
    }

    getChannelNeededRoute(channelId) {
        return `${this.url}${this.urlVersion}/teams/${this.teamId}/channels/${channelId}`;
    }

    getUsersRoute() {
        return `${this.url}${this.urlVersion}/users`;
    }

    setTranslations = (messages) => {
        this.translations = messages;
    }

    logErrorsToConsole= () => {
        this.logToConsole = true;
    }

    track = (category, action, label, property, value) => { //eslint-disable-line no-unused-vars
        // NO-OP for inherited classes to override
    }

    trackPage = () => {
        // NO-OP for inherited classes to override
    }

    handleError = (err, res) => { //eslint-disable-line no-unused-vars
        // NO-OP for inherited classes to override
    }

    handleResponse = (methodName, successCallback, errorCallback, err, res) => {
        if (res && res.header) {
            this.serverVersion = res.header['x-version-id'];
            if (res.header['x-version-id']) {
                this.serverVersion = res.header['x-version-id'];
            }
        }

        if (err) {
            // test to make sure it looks like a server JSON error response
            var e = null;
            if (res && res.body && res.body.id) {
                e = res.body;
            }

            var msg = '';

            if (e) {
                msg = 'method=' + methodName + ' msg=' + e.message + ' detail=' + e.detailed_error + ' rid=' + e.request_id;
            } else {
                msg = 'method=' + methodName + ' status=' + err.status + ' statusCode=' + err.statusCode + ' err=' + err;

                if (err.status === 0) {
                    e = {message: this.translations.connectionError};
                } else {
                    e = {message: this.translations.unknownError + ' (' + err.status + ')'};
                }
            }

            if (this.logToConsole) {
                console.error(msg); //eslint-disable-line no-console
                console.error(e); //eslint-disable-line no-console
            }

            this.track('api', 'api_weberror', methodName, 'message', msg);

            this.handleError(err, res);

            if (errorCallback) {
                errorCallback(e, err, res);
            }
        }

        if (successCallback) {
            successCallback(res.body, res);
        }
    }

    getClientConfig = (success, error) => {
        return request.
            get(`${this.getAdminRoute()}/client_props`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getClientConfig', success, error));
    }

    getClientLicenceConfig = (success, error) => {
        request.
            get(`${this.getLicenseRoute()}/client_config`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getClientLicenceConfig', success, error));
    }

    signupTeam = (email, success, error) => {
        request.
            post(`${this.getTeamsRoute()}/signup`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({email}).
            end(this.handleResponse.bind(this, 'signupTeam', success, error));

        this.track('api', 'api_teams_signup');
    }

    createTeamFromSignup = (teamSignup, success, error) => {
        request.
            post(`${this.getTeamsRoute()}/create_from_signup`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(teamSignup).
            end(this.handleResponse.bind(this, 'createTeamFromSignup', success, error));
    }

    findTeamByName = (teamName, success, error) => {
        request.
            post(`${this.getTeamsRoute()}/find_team_by_name`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({teamName}).
            end(this.handleResponse.bind(this, 'findTeamByName', success, error));
    }

    getMeLoggedIn = (success, error) => {
        request.
            get(`${this.getUsersRoute()}/me_logged_in`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getMeLoggedIn', success, error));
    }
}
