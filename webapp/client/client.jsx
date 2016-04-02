// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import request from 'superagent';

const HEADER_X_VERSION_ID = 'x-version-id';
const HEADER_TOKEN = 'token';
const HEADER_BEARER = 'BEARER';
const HEADER_AUTH = 'Authorization';

export default class Client {
    constructor() {
        this.teamId = '';
        this.serverVersion = '';
        this.logToConsole = false;
        this.useToken = false;
        this.token = '';
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
        if (this.teamId === '') {
            console.error('You are trying to use a route that requires a team_id, but you havn\'t called setTeamId() in client.jsx'); // eslint-disable-line no-console
        }

        return this.teamId;
    }

    getServerVersion = () => {
        return this.serverVersion;
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
        return `${this.url}${this.urlVersion}/teams/${this.getTeamId()}`;
    }

    getChannelsRoute() {
        return `${this.url}${this.urlVersion}/teams/${this.getTeamId()}/channels`;
    }

    getChannelNeededRoute(channelId) {
        return `${this.url}${this.urlVersion}/teams/${this.getTeamId()}/channels/${channelId}`;
    }

    getUsersRoute() {
        return `${this.url}${this.urlVersion}/users`;
    }

    setTranslations = (messages) => {
        this.translations = messages;
    }

    logErrorsToConsole = () => {
        this.logToConsole = true;
    }

    useHeaderToken = () => {
        this.useToken = true;
        if (this.token !== '') {
            this.defaultHeaders[HEADER_AUTH] = `${HEADER_BEARER} ${this.token}`;
        }
    }

    track = (category, action, label, property, value) => { // eslint-disable-line no-unused-vars
        // NO-OP for inherited classes to override
    }

    trackPage = () => {
        // NO-OP for inherited classes to override
    }

    handleError = (err, res) => { // eslint-disable-line no-unused-vars
        // NO-OP for inherited classes to override
    }

    handleResponse = (methodName, successCallback, errorCallback, err, res) => {
        if (res && res.header) {
            this.serverVersion = res.header[HEADER_X_VERSION_ID];
            if (res.header[HEADER_X_VERSION_ID]) {
                this.serverVersion = res.header[HEADER_X_VERSION_ID];
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
                console.error(msg); // eslint-disable-line no-console
                console.error(e); // eslint-disable-line no-console
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

    // General / Admin / Licensing Routes Section

    getTranslations = (url, success, error) => {
        return request.
            get(url).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getTranslations', success, error));
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

    // Team Routes Section

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
            send({name: teamName}).
            end(this.handleResponse.bind(this, 'findTeamByName', success, error));
    }

    createTeam = (team, success, error) => {
        request.
            post(`${this.getTeamsRoute()}/create`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(team).
            end(this.handleResponse.bind(this, 'createTeam', success, error));

        this.track('api', 'api_users_create', '', 'email', team.name);
    }

    getAllTeams = (success, error) => {
        request.
            get(`${this.getTeamsRoute()}/all`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getAllTeams', success, error));
    }

    // User Routes Setions

    createUser = (user, success, error) => {
        request.
            post(`${this.getUsersRoute()}/create`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(user).
            end(this.handleResponse.bind(this, 'createUser', success, error));

        this.track('api', 'api_users_create', '', 'email', user.email);
    }

    getMeLoggedIn = (success, error) => {
        request.
            get(`${this.getUsersRoute()}/me_logged_in`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getMeLoggedIn', success, error));
    }

    getAllPreferences = (success, error) => {
        request.
            get(`${this.getBaseRoute()}/preferences/`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getAllPreferences', success, error));
    }

    login = (email, password, mfaToken, success, error) => {
        var outer = this;  // eslint-disable-line consistent-this

        request.
            post(`${this.getUsersRoute()}/login`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({email, password, token: mfaToken}).
            end(this.handleResponse.bind(
                this,
                'login',
                (data, res) => {
                    if (res && res.header) {
                        outer.token = res.header[HEADER_TOKEN];

                        if (outer.useToken) {
                            outer.defaultHeaders[HEADER_AUTH] = `${HEADER_BEARER} ${outer.token}`;
                        }
                    }

                    if (success) {
                        success(data, res);
                    }
                },
                error
            ));

        this.track('api', 'api_users_login', '', 'email', email);
    }

    // Channel Routes Section

    createChannel = (channel, success, error) => {
        request.
            post(`${this.getChannelsRoute()}/create`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(channel).
            end(this.handleResponse.bind(this, 'createChannel', success, error));

        this.track('api', 'api_channels_create', channel.type, 'name', channel.name);
    }
}
