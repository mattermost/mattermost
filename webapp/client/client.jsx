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

    getUserNeededRoute(userId) {
        return `${this.url}${this.urlVersion}/users/${userId}`;
    }

    setTranslations = (messages) => {
        this.translations = messages;
    }

    enableLogErrorsToConsole = (enabled) => {
        this.logToConsole = enabled;
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
                return;
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

    getComplianceReports = (success, error) => {
        return request.
            get(`${this.getAdminRoute()}/compliance_reports`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getComplianceReports', success, error));
    }

    saveComplianceReports = (job, success, error) => {
        return request.
            post(`${this.getAdminRoute()}/save_compliance_report`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(job).
            end(this.handleResponse.bind(this, 'saveComplianceReports', success, error));
    }

    getLogs = (success, error) => {
        return request.
            get(`${this.getAdminRoute()}/logs`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getLogs', success, error));
    }

    getServerAudits = (success, error) => {
        return request.
            get(`${this.getAdminRoute()}/config`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getServerAudits', success, error));
    }

    getConfig = (success, error) => {
        return request.
            get(`${this.getAdminRoute()}/audits`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getConfig', success, error));
    }

    getAnalytics = (name, teamId, success, error) => {
        let url = `${this.getAdminRoute()}/analytics/`;
        if (teamId == null) {
            url += name;
        } else {
            url += teamId + '/' + name;
        }

        return request.
            get(url).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getAnalytics', success, error));
    }

    getTeamAnalytics = (teamId, name, success, error) => {
        return request.
            get(`${this.getAdminRoute()}/analytics/${teamId}/${name}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getTeamAnalytics', success, error));
    }

    saveConfig = (config, success, error) => {
        request.
            post(`${this.getAdminRoute()}/save_config`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(config).
            end(this.handleResponse.bind(this, 'saveConfig', success, error));
    }

    logClientError = (msg) => {
        var l = {};
        l.level = 'ERROR';
        l.message = msg;

        request.
            post(`${this.getAdminRoute()}/log_client`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(l).
            end(this.handleResponse.bind(this, 'logClientError', null, null));
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

    createTeamWithLdap = (teamSignup, success, error) => {
        request.
            post(`${this.getTeamsRoute()}/create_with_ldap`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(teamSignup).
            end(this.handleResponse.bind(this, 'createTeamWithLdap', success, error));
    }

    createTeamWithSSO = (team, service, success, error) => {
        request.
            post(`${this.getTeamsRoute()}/create_with_ldap/${service}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(team).
            end(this.handleResponse.bind(this, 'createTeamWithSSO', success, error));
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

    updateUser = (user, success, error) => {
        request.
            post(`${this.getUsersRoute()}/update`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(user).
            end(this.handleResponse.bind(this, 'updateUser', success, error));

        this.track('api', 'api_users_update');
    }

    updatePassword = (userId, currentPassword, newPassword, success, error) => {
        var data = {};
        data.user_id = userId;
        data.current_password = currentPassword;
        data.new_password = newPassword;

        request.
            post(`${this.getUsersRoute()}/newpassword`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'updatePassword', success, error));

        this.track('api', 'api_users_newpassword');
    }

    updateUserNotifyProps = (notifyProps, success, error) => {
        request.
            post(`${this.getUsersRoute()}/update_notify`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(notifyProps).
            end(this.handleResponse.bind(this, 'updateUserNotifyProps', success, error));
    }

    updateRoles = (userId, newRoles, success, error) => {
        var data = {
            user_id: userId,
            new_roles: newRoles
        };

        request.
            post(`${this.getUsersRoute()}/update_roles`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'updateRoles', success, error));

        this.track('api', 'api_users_update_roles');
    }

    updateActive = (userId, active, success, error) => {
        var data = {};
        data.user_id = userId;
        data.active = '' + active;

        request.
            post(`${this.getUsersRoute()}/update_active`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'updateActive', success, error));

        this.track('api', 'api_users_update_roles');
    }

    sendPasswordReset = (email, success, error) => {
        var data = {};
        data.email = email;

        request.
            post(`${this.getUsersRoute()}/send_password_reset`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'sendPasswordReset', success, error));

        this.track('api', 'api_users_send_password_reset');
    }

    resetPassword = (userId, newPassword, hash, dataToHash, success, error) => {
        var data = {};
        data.new_password = newPassword;
        data.hash = hash;
        data.data = dataToHash;
        data.user_id = userId;

        request.
            post(`${this.getUsersRoute()}/reset_password`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'resetPassword', success, error));

        this.track('api', 'api_users_reset_password');
    }

    emailToOAuth = (email, password, service, success, error) => {
        var data = {};
        data.password = password;
        data.email = email;
        data.service = service;

        request.
            post(`${this.getUsersRoute()}/claim/email_to_oauth`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'emailToOAuth', success, error));

        this.track('api', 'api_users_email_to_oauth');
    }

    oauthToEmail = (email, password, success, error) => {
        var data = {};
        data.password = password;
        data.email = email;

        request.
            post(`${this.getUsersRoute()}/claim/oauth_to_email`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'oauthToEmail', success, error));

        this.track('api', 'api_users_oauth_to_email');
    }

    emailToLdap = (email, password, ldapId, ldapPassword, success, error) => {
        var data = {};
        data.email_password = password;
        data.email = email;
        data.ldap_id = ldapId;
        data.ldap_password = ldapPassword;

        request.
            post(`${this.getUsersRoute()}/claim/email_to_ldap`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'emailToLdap', success, error));

        this.track('api', 'api_users_email_to_ldap');
    }

    ldapToEmail = (email, emailPassword, ldapPassword, success, error) => {
        var data = {};
        data.email = email;
        data.ldap_password = ldapPassword;
        data.email_password = emailPassword;

        request.
            post(`${this.getUsersRoute()}/claim/ldap_to_email`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'ldapToEmail', success, error));

        this.track('api', 'api_users_oauth_to_email');
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

    login = (email, username, password, mfaToken, success, error) => {
        var outer = this;  // eslint-disable-line consistent-this

        request.
            post(`${this.getUsersRoute()}/login`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({email, password, username, token: mfaToken}).
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

    loginByLdap = (ldapId, password, mfaToken, success, error) => {
        var outer = this;  // eslint-disable-line consistent-this

        request.
            post(`${this.getUsersRoute()}/login_ldap`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({id: ldapId, password, token: mfaToken}).
            end(this.handleResponse.bind(
                this,
                'loginByLdap',
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

        this.track('api', 'api_users_loginLdap', '', 'email', ldapId);
    }

    logout = (success, error) => {
        request.
            post(`${this.getUsersRoute()}/logout`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'logout', success, error));

        this.track('api', 'api_users_logout');
    }

    checkMfa = (method, loginId, success, error) => {
        var data = {};
        data.method = method;
        data.login_id = loginId;

        request.
            post(`${this.getUsersRoute()}/mfa`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'checkMfa', success, error));

        this.track('api', 'api_users_oauth_to_email');
    }

    revokeSession = (altId, success, error) => {
        request.
            post(`${this.getUsersRoute()}/revoke_session`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({id: altId}).
            end(this.handleResponse.bind(this, 'revokeSession', success, error));
    }

    getSessions = (userId, success, error) => {
        request.
            get(`${this.getUserNeededRoute(userId)}/sessions`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getSessions', success, error));
    }

    getAudits = (userId, success, error) => {
        request.
            get(`${this.getUserNeededRoute(userId)}/audits`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getAudits', success, error));
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
