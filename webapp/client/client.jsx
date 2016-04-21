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
        this.urlVersion = '/api/v3';
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
            console.error('You are trying to use a route that requires a team_id, but you have not called setTeamId() in client.jsx'); // eslint-disable-line no-console
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

    getCommandsRoute() {
        return `${this.url}${this.urlVersion}/teams/${this.getTeamId()}/commands`;
    }

    getHooksRoute() {
        return `${this.url}${this.urlVersion}/teams/${this.getTeamId()}/hooks`;
    }

    getPostsRoute(channelId) {
        return `${this.url}${this.urlVersion}/teams/${this.getTeamId()}/channels/${channelId}/posts`;
    }

    getUsersRoute() {
        return `${this.url}${this.urlVersion}/users`;
    }

    getFilesRoute() {
        return `${this.url}${this.urlVersion}/teams/${this.getTeamId()}/files`;
    }

    getOAuthRoute() {
        return `${this.url}${this.urlVersion}/oauth`;
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

                if (err.status === 0 || !err.status) {
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

    uploadBrandImage = (image, success, error) => {
        request.
            post(`${this.getAdminRoute()}/upload_brand_image`).
            set(this.defaultHeaders).
            accept('application/json').
            attach('image', image, image.name).
            end(this.handleResponse.bind(this, 'uploadBrandImage', success, error));
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
            get(`${this.getAdminRoute()}/audits`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getServerAudits', success, error));
    }

    getConfig = (success, error) => {
        return request.
            get(`${this.getAdminRoute()}/config`).
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

    testEmail = (config, success, error) => {
        request.
            post(`${this.getAdminRoute()}/test_email`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(config).
            end(this.handleResponse.bind(this, 'testEmail', success, error));
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

    removeLicenseFile = (success, error) => {
        request.
            post(`${this.getLicenseRoute()}/remove`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'removeLicenseFile', success, error));
    }

    uploadLicenseFile = (license, success, error) => {
        request.
            post(`${this.getLicenseRoute()}/add`).
            set(this.defaultHeaders).
            accept('application/json').
            attach('license', license, license.name).
            end(this.handleResponse.bind(this, 'uploadLicenseFile', success, error));

        this.track('api', 'api_license_upload');
    }

    importSlack = (fileData, success, error) => {
        request.
            post(`${this.getTeamsRoute()}/import_team`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(fileData).
            end(this.handleResponse.bind(this, 'importSlack', success, error));
    }

    exportTeam = (success, error) => {
        request.
            get(`${this.getTeamsRoute()}/export_team`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'exportTeam', success, error));
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

    adminResetMfa = (userId, success, error) => {
        const data = {};
        data.user_id = userId;

        request.
            post(`${this.getAdminRoute()}/reset_mfa`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'adminResetMfa', success, error));
    }

    adminResetPassword = (userId, newPassword, success, error) => {
        var data = {};
        data.new_password = newPassword;
        data.user_id = userId;

        request.
            post(`${this.getAdminRoute()}/reset_password`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'adminResetPassword', success, error));

        this.track('api', 'api_admin_reset_password');
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

    updateTeam = (team, success, error) => {
        request.
            post(`${this.getTeamNeededRoute()}/update`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(team).
            end(this.handleResponse.bind(this, 'updateTeam', success, error));

        this.track('api', 'api_teams_update_name');
    }

    getAllTeams = (success, error) => {
        request.
            get(`${this.getTeamsRoute()}/all`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getAllTeams', success, error));
    }

    getAllTeamListings = (success, error) => {
        request.
            get(`${this.getTeamsRoute()}/all_team_listings`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getAllTeamListings', success, error));
    }

    getMyTeam = (success, error) => {
        request.
            get(`${this.getTeamNeededRoute()}/me`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getMyTeam', success, error));
    }

    getTeamMembers = (teamId, success, error) => {
        request.
            get(`${this.getTeamsRoute()}/members/${teamId}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getTeamMembers', success, error));
    }

    inviteMembers = (data, success, error) => {
        request.
            post(`${this.getTeamNeededRoute()}/invite_members`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'inviteMembers', success, error));

        this.track('api', 'api_teams_invite_members');
    }

    addUserToTeam = (userId, success, error) => {
        request.
            post(`${this.getTeamNeededRoute()}/add_user_to_team`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({user_id: userId}).
            end(this.handleResponse.bind(this, 'addUserToTeam', success, error));

        this.track('api', 'api_teams_invite_members');
    }

    addUserToTeamFromInvite = (data, hash, inviteId, success, error) => {
        request.
            post(`${this.getTeamsRoute()}/add_user_to_team_from_invite`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({hash, data, invite_id: inviteId}).
            end(this.handleResponse.bind(this, 'addUserToTeam', success, error));

        this.track('api', 'api_teams_invite_members');
    }

    getInviteInfo = (inviteId, success, error) => {
        request.
            post(`${this.getTeamsRoute()}/get_invite_info`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({invite_id: inviteId}).
            end(this.handleResponse.bind(this, 'getInviteInfo', success, error));
    }

    // User Routes Setions

    createUser = (user, success, error) => {
        this.createUserWithInvite(user, null, null, null, success, error);
    }

    createUserWithInvite = (user, data, emailHash, inviteId, success, error) => {
        var url = `${this.getUsersRoute()}/create`;

        if (data || emailHash || inviteId) {
            url += '?d=' + encodeURIComponent(data) + '&h=' + encodeURIComponent(emailHash) + '&iid=' + encodeURIComponent(inviteId);
        }

        request.
            post(url).
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

    resetPassword = (code, newPassword, success, error) => {
        var data = {};
        data.new_password = newPassword;
        data.code = code;

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

    getInitialLoad = (success, error) => {
        request.
            get(`${this.getUsersRoute()}/initial_load`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getInitialLoad', success, error));
    }

    getMe = (success, error) => {
        request.
            get(`${this.getUsersRoute()}/me`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getMe', success, error));
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

    getDirectProfiles = (success, error) => {
        request.
            get(`${this.getUsersRoute()}/direct_profiles`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getDirectProfiles', success, error));
    }

    getProfiles = (success, error) => {
        request.
            get(`${this.getUsersRoute()}/profiles/${this.getTeamId()}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getProfiles', success, error));
    }

    getProfilesForTeam = (teamId, success, error) => {
        request.
            get(`${this.getUsersRoute()}/profiles/${teamId}?skip_direct=true`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getProfilesForTeam', success, error));
    }

    getStatuses = (ids, success, error) => {
        request.
            post(`${this.getUsersRoute()}/status`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(ids).
            end(this.handleResponse.bind(this, 'getStatuses', success, error));
    }

    verifyEmail = (uid, hid, success, error) => {
        request.
            post(`${this.getUsersRoute()}/verify_email`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({uid, hid}).
            end(this.handleResponse.bind(this, 'verifyEmail', success, error));
    }

    resendVerification = (email, success, error) => {
        request.
            post(`${this.getUsersRoute()}/resend_verification`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({email}).
            end(this.handleResponse.bind(this, 'resendVerification', success, error));
    }

    updateMfa = (token, activate, success, error) => {
        const data = {};
        data.activate = activate;
        data.token = token;

        request.
            post(`${this.getUsersRoute()}/update_mfa`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'updateMfa', success, error));
    }

    uploadProfileImage = (image, success, error) => {
        request.
            post(`${this.getUsersRoute()}/newimage`).
            set(this.defaultHeaders).
            attach('image', image, image.name).
            accept('application/json').
            end(this.handleResponse.bind(this, 'uploadProfileImage', success, error));
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

    createDirectChannel = (userId, success, error) => {
        request.
            post(`${this.getChannelsRoute()}/create_direct`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({user_id: userId}).
            end(this.handleResponse.bind(this, 'createDirectChannel', success, error));
    }

    updateChannel = (channel, success, error) => {
        request.
            post(`${this.getChannelsRoute()}/update`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(channel).
            end(this.handleResponse.bind(this, 'updateChannel', success, error));

        this.track('api', 'api_channels_update');
    }

    updateChannelHeader = (channelId, header, success, error) => {
        const data = {
            channel_id: channelId,
            channel_header: header
        };

        request.
            post(`${this.getChannelsRoute()}/update_header`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'updateChannel', success, error));

        this.track('api', 'api_channels_header');
    }

    updateChannelPurpose = (channelId, purpose, success, error) => {
        const data = {
            channel_id: channelId,
            channel_purpose: purpose
        };

        request.
            post(`${this.getChannelsRoute()}/update_purpose`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'updateChannelPurpose', success, error));

        this.track('api', 'api_channels_purpose');
    }

    updateChannelNotifyProps = (data, success, error) => {
        request.
            post(`${this.getChannelsRoute()}/update_notify_props`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'updateChannelNotifyProps', success, error));
    }

    leaveChannel = (channelId, success, error) => {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/leave`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'leaveChannel', success, error));

        this.track('api', 'api_channels_leave');
    }

    joinChannel = (channelId, success, error) => {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/join`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'joinChannel', success, error));

        this.track('api', 'api_channels_join');
    }

    deleteChannel = (channelId, success, error) => {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/delete`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'deleteChannel', success, error));

        this.track('api', 'api_channels_delete');
    }

    updateLastViewedAt = (channelId, success, error) => {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/update_last_viewed_at`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'updateLastViewedAt', success, error));
    }

    getChannels = (success, error) => {
        request.
            get(`${this.getChannelsRoute()}/`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getChannels', success, error));
    }

    getChannel = (channelId, success, error) => {
        request.
            get(`${this.getChannelNeededRoute(channelId)}/`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getChannel', success, error));

        this.track('api', 'api_channel_get');
    }

    getMoreChannels = (success, error) => {
        request.
            get(`${this.getChannelsRoute()}/more`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getMoreChannels', success, error));
    }

    getChannelCounts = (success, error) => {
        request.
            get(`${this.getChannelsRoute()}/counts`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getChannelCounts', success, error));
    }

    getChannelExtraInfo = (channelId, memberLimit, success, error) => {
        var url = `${this.getChannelNeededRoute(channelId)}/extra_info`;
        if (memberLimit) {
            url += '/' + memberLimit;
        }

        request.
            get(url).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getChannelExtraInfo', success, error));
    }

    addChannelMember = (channelId, userId, success, error) => {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/add`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({user_id: userId}).
            end(this.handleResponse.bind(this, 'addChannelMember', success, error));

        this.track('api', 'api_channels_add_member');
    }

    removeChannelMember = (channelId, userId, success, error) => {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/remove`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({user_id: userId}).
            end(this.handleResponse.bind(this, 'removeChannelMember', success, error));

        this.track('api', 'api_channels_remove_member');
    }

    // Routes for Commands

    listCommands = (success, error) => {
        request.
            get(`${this.getCommandsRoute()}/list`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'listCommands', success, error));
    }

    executeCommand = (channelId, command, suggest, success, error) => {
        request.
            post(`${this.getCommandsRoute()}/execute`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({channelId, command, suggest: '' + suggest}).
            end(this.handleResponse.bind(this, 'executeCommand', success, error));
    }

    addCommand = (command, success, error) => {
        request.
            post(`${this.getCommandsRoute()}/create`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(command).
            end(this.handleResponse.bind(this, 'addCommand', success, error));
    }

    deleteCommand = (commandId, success, error) => {
        request.
            post(`${this.getCommandsRoute()}/delete`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({id: commandId}).
            end(this.handleResponse.bind(this, 'deleteCommand', success, error));
    }

    listTeamCommands = (success, error) => {
        request.
            get(`${this.getCommandsRoute()}/list_team_commands`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'listTeamCommands', success, error));
    }

    regenCommandToken = (commandId, suggest, success, error) => {
        request.
            post(`${this.getCommandsRoute()}/regen_token`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({id: commandId}).
            end(this.handleResponse.bind(this, 'regenCommandToken', success, error));
    }

    // Routes for Posts

    createPost = (post, success, error) => {
        request.
            post(`${this.getPostsRoute(post.channel_id)}/create`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(post).
            end(this.handleResponse.bind(this, 'createPost', success, error));

        this.track('api', 'api_posts_create', post.channel_id, 'length', post.message.length);
    }

    getPostById = (postId, success, error) => {
        request.
            get(`${this.getTeamNeededRoute()}/posts/${postId}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPostById', success, error));
    }

    getPost = (channelId, postId, success, error) => {
        request.
            get(`${this.getChannelNeededRoute(channelId)}/posts/${postId}/get`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPost', success, error));
    }

    updatePost = (post, success, error) => {
        request.
            post(`${this.getPostsRoute(post.channel_id)}/update`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(post).
            end(this.handleResponse.bind(this, 'updatePost', success, error));

        this.track('api', 'api_posts_update');
    }

    deletePost = (channelId, postId, success, error) => {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/posts/${postId}/delete`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'deletePost', success, error));

        this.track('api', 'api_posts_delete');
    }

    search = (terms, success, error) => {
        request.
            get(`${this.getTeamNeededRoute()}/posts/search`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            query({terms}).
            end(this.handleResponse.bind(this, 'search', success, error));

        this.track('api', 'api_posts_search');
    }

    getPostsPage = (channelId, offset, limit, success, error) => {
        request.
            get(`${this.getPostsRoute(channelId)}/page/${offset}/${limit}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPostsPage', success, error));
    }

    getPosts = (channelId, since, success, error) => {
        request.
            get(`${this.getPostsRoute(channelId)}/since/${since}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPosts', success, error));
    }

    getPostsBefore = (channelId, postId, offset, numPost, success, error) => {
        request.
            get(`${this.getPostsRoute(channelId)}/${postId}/before/${offset}/${numPost}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPostsBefore', success, error));
    }

    getPostsAfter = (channelId, postId, offset, numPost, success, error) => {
        request.
            get(`${this.getPostsRoute(channelId)}/${postId}/after/${offset}/${numPost}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPostsAfter', success, error));
    }

    // Routes for Files

    getFileInfo = (filename, success, error) => {
        request.
            get(`${this.getFilesRoute()}/get_info${filename}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getFileInfo', success, error));
    }

    getPublicLink = (data, success, error) => {
        request.
            post(`${this.getFilesRoute()}/get_public_link`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'getPublicLink', success, error));
    }

    uploadFile = (file, filename, channelId, clientId, success, error) => {
        return request.
            post(`${this.getFilesRoute()}/upload`).
            set(this.defaultHeaders).
            attach('files', file, filename).
            field('channel_id', channelId).
            field('client_ids', clientId).
            accept('application/json').
            end(this.handleResponse.bind(this, 'uploadFile', success, error));
    }

    // Routes for OAuth

    registerOAuthApp = (app, success, error) => {
        request.
            post(`${this.getOAuthRoute()}/register`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(app).
            end(this.handleResponse.bind(this, 'registerOAuthApp', success, error));

        this.track('api', 'api_apps_register');
    }

    allowOAuth2 = (responseType, clientId, redirectUri, state, scope, success, error) => {
        request.
            get(`${this.getOAuthRoute()}/allow`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            query({response_type: responseType}).
            query({client_id: clientId}).
            query({redirect_uri: redirectUri}).
            query({scope}).
            query({state}).
            end(this.handleResponse.bind(this, 'allowOAuth2', success, error));
    }

    // Routes for Hooks

    addIncomingHook = (hook, success, error) => {
        request.
            post(`${this.getHooksRoute()}/incoming/create`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(hook).
            end(this.handleResponse.bind(this, 'addIncomingHook', success, error));
    }

    deleteIncomingHook = (hookId, success, error) => {
        request.
            post(`${this.getHooksRoute()}/incoming/delete`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({id: hookId}).
            end(this.handleResponse.bind(this, 'deleteIncomingHook', success, error));
    }

    listIncomingHooks = (success, error) => {
        request.
            get(`${this.getHooksRoute()}/incoming/list`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'listIncomingHooks', success, error));
    }

    addOutgoingHook = (hook, success, error) => {
        request.
            post(`${this.getHooksRoute()}/outgoing/create`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(hook).
            end(this.handleResponse.bind(this, 'addOutgoingHook', success, error));
    }

    deleteOutgoingHook = (hookId, success, error) => {
        request.
            post(`${this.getHooksRoute()}/outgoing/delete`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({id: hookId}).
            end(this.handleResponse.bind(this, 'deleteOutgoingHook', success, error));
    }

    listOutgoingHooks = (success, error) => {
        request.
            get(`${this.getHooksRoute()}/outgoing/list`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'listOutgoingHooks', success, error));
    }

    regenOutgoingHookToken = (hookId, success, error) => {
        request.
            post(`${this.getHooksRoute()}/outgoing/regen_token`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({id: hookId}).
            end(this.handleResponse.bind(this, 'regenOutgoingHookToken', success, error));
    }

    //Routes for Prefrecnes

    getAllPreferences = (success, error) => {
        request.
            get(`${this.getBaseRoute()}/preferences/`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getAllPreferences', success, error));
    }

    savePreferences = (preferences, success, error) => {
        request.
            post(`${this.getBaseRoute()}/preferences/save`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(preferences).
            end(this.handleResponse.bind(this, 'savePreferences', success, error));
    }

    getPreferenceCategory = (category, success, error) => {
        request.
            get(`${this.getBaseRoute()}/preferences/${category}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPreferenceCategory', success, error));
    }
}
