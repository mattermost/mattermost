// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import request from 'superagent';

const HEADER_X_VERSION_ID = 'x-version-id';
const HEADER_X_CLUSTER_ID = 'x-cluster-id';
const HEADER_TOKEN = 'token';
const HEADER_BEARER = 'BEARER';
const HEADER_AUTH = 'Authorization';

export default class Client {
    constructor() {
        this.teamId = '';
        this.serverVersion = '';
        this.clusterId = '';
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

    setUrl(url) {
        this.url = url;
    }

    setAcceptLanguage(locale) {
        this.defaultHeaders['Accept-Language'] = locale;
    }

    setTeamId(id) {
        this.teamId = id;
    }

    getTeamId() {
        if (!this.teamId) {
            console.error('You are trying to use a route that requires a team_id, but you have not called setTeamId() in client.jsx'); // eslint-disable-line no-console
        }

        return this.teamId;
    }

    getServerVersion() {
        return this.serverVersion;
    }

    getBaseRoute() {
        return `${this.url}${this.urlVersion}`;
    }

    getAdminRoute() {
        return `${this.url}${this.urlVersion}/admin`;
    }

    getGeneralRoute() {
        return `${this.url}${this.urlVersion}/general`;
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

    getChannelNameRoute(channelName) {
        return `${this.url}${this.urlVersion}/teams/${this.getTeamId()}/channels/name/${channelName}`;
    }

    getChannelNeededRoute(channelId) {
        return `${this.url}${this.urlVersion}/teams/${this.getTeamId()}/channels/${channelId}`;
    }

    getCommandsRoute() {
        return `${this.url}${this.urlVersion}/teams/${this.getTeamId()}/commands`;
    }

    getEmojiRoute() {
        return `${this.url}${this.urlVersion}/emoji`;
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

    setTranslations(messages) {
        this.translations = messages;
    }

    enableLogErrorsToConsole(enabled) {
        this.logToConsole = enabled;
    }

    useHeaderToken() {
        this.useToken = true;
        if (this.token !== '') {
            this.defaultHeaders[HEADER_AUTH] = `${HEADER_BEARER} ${this.token}`;
        }
    }

    track(category, action, label, property, value) { // eslint-disable-line no-unused-vars
        // NO-OP for inherited classes to override
    }

    trackPage() {
        // NO-OP for inherited classes to override
    }

    handleError(err, res) { // eslint-disable-line no-unused-vars
        // NO-OP for inherited classes to override
    }

    handleResponse(methodName, successCallback, errorCallback, err, res) {
        if (res && res.header) {
            this.serverVersion = res.header[HEADER_X_VERSION_ID];
            if (res.header[HEADER_X_VERSION_ID]) {
                this.serverVersion = res.header[HEADER_X_VERSION_ID];
            }

            this.clusterId = res.header[HEADER_X_CLUSTER_ID];
            if (res.header[HEADER_X_CLUSTER_ID]) {
                this.clusterId = res.header[HEADER_X_CLUSTER_ID];
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

    // General Routes Section

    getClientConfig(success, error) {
        return request.
            get(`${this.getGeneralRoute()}/client_props`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getClientConfig', success, error));
    }

    getPing(success, error) {
        return request.
            get(`${this.getGeneralRoute()}/ping`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPing', success, error));
    }

    logClientError(msg) {
        var l = {};
        l.level = 'ERROR';
        l.message = msg;

        request.
            post(`${this.getGeneralRoute()}/log_client`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(l).
            end(this.handleResponse.bind(this, 'logClientError', null, null));
    }

    // Admin / Licensing Routes Section

    reloadConfig(success, error) {
        return request.
            get(`${this.getAdminRoute()}/reload_config`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'reloadConfig', success, error));
    }

    recycleDatabaseConnection(success, error) {
        return request.
            get(`${this.getAdminRoute()}/recycle_db_conn`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'recycleDatabaseConnection', success, error));
    }

    getTranslations(url, success, error) {
        return request.
            get(url).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getTranslations', success, error));
    }

    getComplianceReports(success, error) {
        return request.
            get(`${this.getAdminRoute()}/compliance_reports`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getComplianceReports', success, error));
    }

    uploadBrandImage(image, success, error) {
        request.
            post(`${this.getAdminRoute()}/upload_brand_image`).
            set(this.defaultHeaders).
            accept('application/json').
            attach('image', image, image.name).
            end(this.handleResponse.bind(this, 'uploadBrandImage', success, error));
    }

    saveComplianceReports(job, success, error) {
        return request.
            post(`${this.getAdminRoute()}/save_compliance_report`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(job).
            end(this.handleResponse.bind(this, 'saveComplianceReports', success, error));
    }

    getLogs(success, error) {
        return request.
            get(`${this.getAdminRoute()}/logs`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getLogs', success, error));
    }

    getClusterStatus(success, error) {
        return request.
            get(`${this.getAdminRoute()}/cluster_status`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getClusterStatus', success, error));
    }

    getServerAudits(success, error) {
        return request.
            get(`${this.getAdminRoute()}/audits`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getServerAudits', success, error));
    }

    getConfig(success, error) {
        return request.
            get(`${this.getAdminRoute()}/config`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getConfig', success, error));
    }

    getAnalytics(name, teamId, success, error) {
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

    getTeamAnalytics(teamId, name, success, error) {
        return request.
            get(`${this.getAdminRoute()}/analytics/${teamId}/${name}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getTeamAnalytics', success, error));
    }

    saveConfig(config, success, error) {
        request.
            post(`${this.getAdminRoute()}/save_config`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(config).
            end(this.handleResponse.bind(this, 'saveConfig', success, error));
    }

    testEmail(config, success, error) {
        request.
            post(`${this.getAdminRoute()}/test_email`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(config).
            end(this.handleResponse.bind(this, 'testEmail', success, error));
    }

    getClientLicenceConfig(success, error) {
        request.
            get(`${this.getLicenseRoute()}/client_config`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getClientLicenceConfig', success, error));
    }

    removeLicenseFile(success, error) {
        request.
            post(`${this.getLicenseRoute()}/remove`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'removeLicenseFile', success, error));
    }

    uploadLicenseFile(license, success, error) {
        request.
            post(`${this.getLicenseRoute()}/add`).
            set(this.defaultHeaders).
            accept('application/json').
            attach('license', license, license.name).
            end(this.handleResponse.bind(this, 'uploadLicenseFile', success, error));

        this.track('api', 'api_license_upload');
    }

    importSlack(fileData, success, error) {
        request.
            post(`${this.getTeamNeededRoute()}/import_team`).
            set(this.defaultHeaders).
            accept('application/octet-stream').
            send(fileData).
            end(this.handleResponse.bind(this, 'importSlack', success, error));
    }

    exportTeam(success, error) {
        request.
            get(`${this.getTeamsRoute()}/export_team`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'exportTeam', success, error));
    }

    signupTeam(email, success, error) {
        request.
            post(`${this.getTeamsRoute()}/signup`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({email}).
            end(this.handleResponse.bind(this, 'signupTeam', success, error));

        this.track('api', 'api_teams_signup');
    }

    adminResetMfa(userId, success, error) {
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

    adminResetPassword(userId, newPassword, success, error) {
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

    ldapSyncNow(success, error) {
        request.
            post(`${this.getAdminRoute()}/ldap_sync_now`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'ldapSyncNow', success, error));
    }

    // Team Routes Section

    createTeamFromSignup(teamSignup, success, error) {
        request.
            post(`${this.getTeamsRoute()}/create_from_signup`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(teamSignup).
            end(this.handleResponse.bind(this, 'createTeamFromSignup', success, error));
    }

    findTeamByName(teamName, success, error) {
        request.
            post(`${this.getTeamsRoute()}/find_team_by_name`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({name: teamName}).
            end(this.handleResponse.bind(this, 'findTeamByName', success, error));
    }

    createTeam(team, success, error) {
        request.
            post(`${this.getTeamsRoute()}/create`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(team).
            end(this.handleResponse.bind(this, 'createTeam', success, error));

        this.track('api', 'api_users_create', '', 'email', team.name);
    }

    updateTeam(team, success, error) {
        request.
            post(`${this.getTeamNeededRoute()}/update`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(team).
            end(this.handleResponse.bind(this, 'updateTeam', success, error));

        this.track('api', 'api_teams_update_name');
    }

    getAllTeams(success, error) {
        request.
            get(`${this.getTeamsRoute()}/all`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getAllTeams', success, error));
    }

    getAllTeamListings(success, error) {
        request.
            get(`${this.getTeamsRoute()}/all_team_listings`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getAllTeamListings', success, error));
    }

    getMyTeam(success, error) {
        request.
            get(`${this.getTeamNeededRoute()}/me`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getMyTeam', success, error));
    }

    getTeamMembers(teamId, success, error) {
        request.
            get(`${this.getTeamsRoute()}/members/${teamId}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getTeamMembers', success, error));
    }

    inviteMembers(data, success, error) {
        request.
            post(`${this.getTeamNeededRoute()}/invite_members`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'inviteMembers', success, error));

        this.track('api', 'api_teams_invite_members');
    }

    addUserToTeam(teamId, userId, success, error) {
        let nonEmptyTeamId = teamId;
        if (nonEmptyTeamId === '') {
            nonEmptyTeamId = this.getTeamId();
        }

        request.
            post(`${this.getTeamsRoute()}/${nonEmptyTeamId}/add_user_to_team`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({user_id: userId}).
            end(this.handleResponse.bind(this, 'addUserToTeam', success, error));

        this.track('api', 'api_teams_invite_members');
    }

    addUserToTeamFromInvite(data, hash, inviteId, success, error) {
        request.
            post(`${this.getTeamsRoute()}/add_user_to_team_from_invite`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({hash, data, invite_id: inviteId}).
            end(this.handleResponse.bind(this, 'addUserToTeam', success, error));

        this.track('api', 'api_teams_invite_members');
    }

    removeUserFromTeam(teamId, userId, success, error) {
        let nonEmptyTeamId = teamId;
        if (nonEmptyTeamId === '') {
            nonEmptyTeamId = this.getTeamId();
        }

        request.
            post(`${this.getTeamsRoute()}/${nonEmptyTeamId}/remove_user_from_team`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({user_id: userId}).
            end(this.handleResponse.bind(this, 'removeUserFromTeam', success, error));

        this.track('api', 'api_teams_remove_members');
    }

    getInviteInfo(inviteId, success, error) {
        request.
            post(`${this.getTeamsRoute()}/get_invite_info`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({invite_id: inviteId}).
            end(this.handleResponse.bind(this, 'getInviteInfo', success, error));
    }

    // User Routes Setions

    createUser(user, success, error) {
        this.createUserWithInvite(user, null, null, null, success, error);
    }

    createUserWithInvite(user, data, emailHash, inviteId, success, error) {
        var url = `${this.getUsersRoute()}/create`;

        url += '?d=' + encodeURIComponent(data);

        if (emailHash) {
            url += '&h=' + encodeURIComponent(emailHash);
        }

        if (inviteId) {
            url += '&iid=' + encodeURIComponent(inviteId);
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

    updateUser(user, type, success, error) {
        request.
            post(`${this.getUsersRoute()}/update`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(user).
            end(this.handleResponse.bind(this, 'updateUser', success, error));

        if (type) {
            this.track('api', 'api_users_update_' + type);
        } else {
            this.track('api', 'api_users_update');
        }
    }

    updatePassword(userId, currentPassword, newPassword, success, error) {
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

    updateUserNotifyProps(notifyProps, success, error) {
        request.
            post(`${this.getUsersRoute()}/update_notify`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(notifyProps).
            end(this.handleResponse.bind(this, 'updateUserNotifyProps', success, error));

        this.track('api', 'api_users_update_notification_settings');
    }

    updateRoles(teamId, userId, newRoles, success, error) {
        var data = {
            team_id: teamId,
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

    updateActive(userId, active, success, error) {
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

    sendPasswordReset(email, success, error) {
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

    resetPassword(code, newPassword, success, error) {
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

    emailToOAuth(email, password, service, success, error) {
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

    oauthToEmail(email, password, success, error) {
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

    emailToLdap(email, password, ldapId, ldapPassword, success, error) {
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

    ldapToEmail(email, emailPassword, ldapPassword, success, error) {
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

    getInitialLoad(success, error) {
        request.
            get(`${this.getUsersRoute()}/initial_load`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getInitialLoad', success, error));
    }

    getMe(success, error) {
        request.
            get(`${this.getUsersRoute()}/me`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getMe', success, error));
    }

    login(loginId, password, mfaToken, success, error) {
        this.doLogin({login_id: loginId, password, token: mfaToken}, success, error);

        this.track('api', 'api_users_login', '', 'login_id', loginId);
    }

    loginById(id, password, mfaToken, success, error) {
        this.doLogin({id, password, token: mfaToken}, success, error);

        this.track('api', 'api_users_login', '', 'id', id);
    }

    loginByLdap(loginId, password, mfaToken, success, error) {
        this.doLogin({login_id: loginId, password, token: mfaToken, ldap_only: 'true'}, success, error);

        this.track('api', 'api_users_login', '', 'login_id', loginId);
    }

    doLogin(outgoingData, success, error) {
        var outer = this;  // eslint-disable-line consistent-this

        request.
            post(`${this.getUsersRoute()}/login`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(outgoingData).
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
    }

    logout(success, error) {
        request.
            post(`${this.getUsersRoute()}/logout`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'logout', success, error));

        this.track('api', 'api_users_logout');
    }

    checkMfa(loginId, success, error) {
        const data = {
            login_id: loginId
        };

        request.
            post(`${this.getUsersRoute()}/mfa`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'checkMfa', success, error));

        this.track('api', 'api_users_oauth_to_email');
    }

    revokeSession(altId, success, error) {
        request.
            post(`${this.getUsersRoute()}/revoke_session`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({id: altId}).
            end(this.handleResponse.bind(this, 'revokeSession', success, error));
    }

    getSessions(userId, success, error) {
        request.
            get(`${this.getUserNeededRoute(userId)}/sessions`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getSessions', success, error));
    }

    getAudits(userId, success, error) {
        request.
            get(`${this.getUserNeededRoute(userId)}/audits`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getAudits', success, error));
    }

    getDirectProfiles(success, error) {
        request.
            get(`${this.getUsersRoute()}/direct_profiles`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getDirectProfiles', success, error));
    }

    getProfiles(success, error) {
        request.
            get(`${this.getUsersRoute()}/profiles/${this.getTeamId()}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getProfiles', success, error));
    }

    getProfilesForTeam(teamId, success, error) {
        request.
            get(`${this.getUsersRoute()}/profiles/${teamId}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getProfilesForTeam', success, error));
    }

    getProfilesForDirectMessageList(success, error) {
        request.
            get(`${this.getUsersRoute()}/profiles_for_dm_list/${this.getTeamId()}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getProfilesForDirectMessageList', success, error));
    }

    getStatuses(success, error) {
        request.
            get(`${this.getUsersRoute()}/status`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getStatuses', success, error));
    }

    verifyEmail(uid, hid, success, error) {
        request.
            post(`${this.getUsersRoute()}/verify_email`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({uid, hid}).
            end(this.handleResponse.bind(this, 'verifyEmail', success, error));
    }

    resendVerification(email, success, error) {
        request.
            post(`${this.getUsersRoute()}/resend_verification`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({email}).
            end(this.handleResponse.bind(this, 'resendVerification', success, error));
    }

    updateMfa(token, activate, success, error) {
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

    uploadProfileImage(image, success, error) {
        request.
            post(`${this.getUsersRoute()}/newimage`).
            set(this.defaultHeaders).
            attach('image', image, image.name).
            accept('application/json').
            end(this.handleResponse.bind(this, 'uploadProfileImage', success, error));

        this.track('api', 'api_users_update_profile_picture');
    }

    // Channel Routes Section

    createChannel(channel, success, error) {
        request.
            post(`${this.getChannelsRoute()}/create`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(channel).
            end(this.handleResponse.bind(this, 'createChannel', success, error));

        this.track('api', 'api_channels_create', channel.type, 'name', channel.name);
    }

    createDirectChannel(userId, success, error) {
        request.
            post(`${this.getChannelsRoute()}/create_direct`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({user_id: userId}).
            end(this.handleResponse.bind(this, 'createDirectChannel', success, error));
    }

    updateChannel(channel, success, error) {
        request.
            post(`${this.getChannelsRoute()}/update`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(channel).
            end(this.handleResponse.bind(this, 'updateChannel', success, error));

        this.track('api', 'api_channels_update');
    }

    updateChannelHeader(channelId, header, success, error) {
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

    updateChannelPurpose(channelId, purpose, success, error) {
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

    updateChannelNotifyProps(data, success, error) {
        request.
            post(`${this.getChannelsRoute()}/update_notify_props`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'updateChannelNotifyProps', success, error));
    }

    leaveChannel(channelId, success, error) {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/leave`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'leaveChannel', success, error));

        this.track('api', 'api_channels_leave');
    }

    joinChannel(channelId, success, error) {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/join`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'joinChannel', success, error));

        this.track('api', 'api_channels_join');
    }

    joinChannelByName(name, success, error) {
        request.
            post(`${this.getChannelNameRoute(name)}/join`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'joinChannelByName', success, error));

        this.track('api', 'api_channels_join_name');
    }

    deleteChannel(channelId, success, error) {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/delete`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'deleteChannel', success, error));

        this.track('api', 'api_channels_delete');
    }

    updateLastViewedAt(channelId, success, error) {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/update_last_viewed_at`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'updateLastViewedAt', success, error));
    }

    setLastViewedAt(channelId, lastViewedAt, success, error) {
        request.
        post(`${this.getChannelNeededRoute(channelId)}/set_last_viewed_at`).
        set(this.defaultHeaders).
        type('application/json').
        accept('application/json').
        send({last_viewed_at: lastViewedAt}).
        end(this.handleResponse.bind(this, 'setLastViewedAt', success, error));
    }

    getChannels(success, error) {
        request.
            get(`${this.getChannelsRoute()}/`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getChannels', success, error));
    }

    getChannel(channelId, success, error) {
        request.
            get(`${this.getChannelNeededRoute(channelId)}/`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getChannel', success, error));

        this.track('api', 'api_channel_get');
    }

    getMoreChannels(success, error) {
        request.
            get(`${this.getChannelsRoute()}/more`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getMoreChannels', success, error));
    }

    getChannelCounts(success, error) {
        request.
            get(`${this.getChannelsRoute()}/counts`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getChannelCounts', success, error));
    }

    getChannelExtraInfo(channelId, memberLimit, success, error) {
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

    addChannelMember(channelId, userId, success, error) {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/add`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({user_id: userId}).
            end(this.handleResponse.bind(this, 'addChannelMember', success, error));

        this.track('api', 'api_channels_add_member');
    }

    removeChannelMember(channelId, userId, success, error) {
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

    listCommands(success, error) {
        request.
            get(`${this.getCommandsRoute()}/list`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'listCommands', success, error));
    }

    executeCommand(channelId, command, suggest, success, error) {
        request.
            post(`${this.getCommandsRoute()}/execute`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({channelId, command, suggest: '' + suggest}).
            end(this.handleResponse.bind(this, 'executeCommand', success, error));

        this.track('api', 'api_integrations_used');
    }

    addCommand(command, success, error) {
        request.
            post(`${this.getCommandsRoute()}/create`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(command).
            end(this.handleResponse.bind(this, 'addCommand', success, error));

        this.track('api', 'api_integrations_created');
    }

    deleteCommand(commandId, success, error) {
        request.
            post(`${this.getCommandsRoute()}/delete`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({id: commandId}).
            end(this.handleResponse.bind(this, 'deleteCommand', success, error));

        this.track('api', 'api_integrations_deleted');
    }

    listTeamCommands(success, error) {
        request.
            get(`${this.getCommandsRoute()}/list_team_commands`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'listTeamCommands', success, error));
    }

    regenCommandToken(commandId, success, error) {
        request.
            post(`${this.getCommandsRoute()}/regen_token`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({id: commandId}).
            end(this.handleResponse.bind(this, 'regenCommandToken', success, error));
    }

    // Routes for Posts

    createPost(post, success, error) {
        request.
            post(`${this.getPostsRoute(post.channel_id)}/create`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(post).
            end(this.handleResponse.bind(this, 'createPost', success, error));

        this.track('api', 'api_posts_create', post.channel_id, 'length', post.message.length);

        if (post.message.match(/\s#./)) {
            this.track('api', 'api_posts_hashtag');
        }

        if (post.message.match(/\s@./)) {
            this.track('api', 'api_posts_mentions');
        }
    }

    // This is a temporary route to get around a problem with the permissions system that
    // will be fixed in 3.1 or 3.2
    getPermalinkTmp(postId, success, error) {
        request.
            get(`${this.getTeamNeededRoute()}/pltmp/${postId}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPermalinkTmp', success, error));
    }

    getPostById(postId, success, error) {
        request.
            get(`${this.getTeamNeededRoute()}/posts/${postId}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPostById', success, error));
    }

    getPost(channelId, postId, success, error) {
        request.
            get(`${this.getChannelNeededRoute(channelId)}/posts/${postId}/get`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPost', success, error));
    }

    updatePost(post, success, error) {
        request.
            post(`${this.getPostsRoute(post.channel_id)}/update`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(post).
            end(this.handleResponse.bind(this, 'updatePost', success, error));

        this.track('api', 'api_posts_update');
    }

    deletePost(channelId, postId, success, error) {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/posts/${postId}/delete`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'deletePost', success, error));

        this.track('api', 'api_posts_delete');
    }

    search(terms, isOrSearch, success, error) {
        const data = {};
        data.terms = terms;
        data.is_or_search = isOrSearch;

        request.
            post(`${this.getTeamNeededRoute()}/posts/search`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'search', success, error));

        this.track('api', 'api_posts_search');
    }

    getPostsPage(channelId, offset, limit, success, error) {
        request.
            get(`${this.getPostsRoute(channelId)}/page/${offset}/${limit}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPostsPage', success, error));
    }

    getPosts(channelId, since, success, error) {
        request.
            get(`${this.getPostsRoute(channelId)}/since/${since}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPosts', success, error));
    }

    getPostsBefore(channelId, postId, offset, numPost, success, error) {
        request.
            get(`${this.getPostsRoute(channelId)}/${postId}/before/${offset}/${numPost}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPostsBefore', success, error));
    }

    getPostsAfter(channelId, postId, offset, numPost, success, error) {
        request.
            get(`${this.getPostsRoute(channelId)}/${postId}/after/${offset}/${numPost}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPostsAfter', success, error));
    }

    getFlaggedPosts(offset, limit, success, error) {
        request.
            get(`${this.getTeamNeededRoute()}/posts/flagged/${offset}/${limit}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getFlaggedPosts', success, error));
    }

    // Routes for Files

    getFileInfo(filename, success, error) {
        request.
            get(`${this.getFilesRoute()}/get_info${filename}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getFileInfo', success, error));
    }

    getPublicLink(filename, success, error) {
        const data = {
            filename
        };

        request.
            post(`${this.getFilesRoute()}/get_public_link`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'getPublicLink', success, error));
    }

    uploadFile(file, filename, channelId, clientId, success, error) {
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

    registerOAuthApp(app, success, error) {
        request.
            post(`${this.getOAuthRoute()}/register`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(app).
            end(this.handleResponse.bind(this, 'registerOAuthApp', success, error));

        this.track('api', 'api_apps_register');
    }

    allowOAuth2(responseType, clientId, redirectUri, state, scope, success, error) {
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

    listOAuthApps(success, error) {
        request.
        get(`${this.getOAuthRoute()}/list`).
        set(this.defaultHeaders).
        type('application/json').
        accept('application/json').
        send().
        end(this.handleResponse.bind(this, 'getOAuthApps', success, error));
    }

    deleteOAuthApp(id, success, error) {
        request.
        post(`${this.getOAuthRoute()}/delete`).
        set(this.defaultHeaders).
        type('application/json').
        accept('application/json').
        send({id}).
        end(this.handleResponse.bind(this, 'deleteOAuthApp', success, error));
    }

    getOAuthAppInfo(id, success, error) {
        request.
        get(`${this.getOAuthRoute()}/app/${id}`).
        set(this.defaultHeaders).
        type('application/json').
        accept('application/json').
        send().
        end(this.handleResponse.bind(this, 'getOAuthAppInfo', success, error));
    }

    // Routes for Hooks

    addIncomingHook(hook, success, error) {
        request.
            post(`${this.getHooksRoute()}/incoming/create`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(hook).
            end(this.handleResponse.bind(this, 'addIncomingHook', success, error));

        this.track('api', 'api_integrations_created');
    }

    deleteIncomingHook(hookId, success, error) {
        request.
            post(`${this.getHooksRoute()}/incoming/delete`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({id: hookId}).
            end(this.handleResponse.bind(this, 'deleteIncomingHook', success, error));

        this.track('api', 'api_integrations_deleted');
    }

    listIncomingHooks(success, error) {
        request.
            get(`${this.getHooksRoute()}/incoming/list`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'listIncomingHooks', success, error));
    }

    addOutgoingHook(hook, success, error) {
        request.
            post(`${this.getHooksRoute()}/outgoing/create`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(hook).
            end(this.handleResponse.bind(this, 'addOutgoingHook', success, error));

        this.track('api', 'api_integrations_created');
    }

    deleteOutgoingHook(hookId, success, error) {
        request.
            post(`${this.getHooksRoute()}/outgoing/delete`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({id: hookId}).
            end(this.handleResponse.bind(this, 'deleteOutgoingHook', success, error));

        this.track('api', 'api_integrations_deleted');
    }

    listOutgoingHooks(success, error) {
        request.
            get(`${this.getHooksRoute()}/outgoing/list`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'listOutgoingHooks', success, error));
    }

    regenOutgoingHookToken(hookId, success, error) {
        request.
            post(`${this.getHooksRoute()}/outgoing/regen_token`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({id: hookId}).
            end(this.handleResponse.bind(this, 'regenOutgoingHookToken', success, error));
    }

    // Routes for Preferences

    getAllPreferences(success, error) {
        request.
            get(`${this.getBaseRoute()}/preferences/`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getAllPreferences', success, error));
    }

    savePreferences(preferences, success, error) {
        request.
            post(`${this.getBaseRoute()}/preferences/save`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(preferences).
            end(this.handleResponse.bind(this, 'savePreferences', success, error));
    }

    getPreferenceCategory(category, success, error) {
        request.
            get(`${this.getBaseRoute()}/preferences/${category}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPreferenceCategory', success, error));
    }

    deletePreferences(preferences, success, error) {
        request.
            post(`${this.getBaseRoute()}/preferences/delete`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(preferences).
            end(this.handleResponse.bind(this, 'deletePreferences', success, error));
    }

    // Routes for Emoji

    listEmoji(success, error) {
        request.
            get(`${this.getEmojiRoute()}/list`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'listEmoji', success, error));
    }

    addEmoji(emoji, image, success, error) {
        request.
            post(`${this.getEmojiRoute()}/create`).
            set(this.defaultHeaders).
            accept('application/json').
            attach('image', image, image.name).
            field('emoji', JSON.stringify(emoji)).
            end(this.handleResponse.bind(this, 'addEmoji', success, error));
    }

    deleteEmoji(id, success, error) {
        request.
            post(`${this.getEmojiRoute()}/delete`).
            set(this.defaultHeaders).
            accept('application/json').
            send({id}).
            end(this.handleResponse.bind(this, 'deleteEmoji', success, error));
    }

    getCustomEmojiImageUrl(id) {
        return `${this.getEmojiRoute()}/${id}`;
    }

    uploadCertificateFile(file, success, error) {
        request.
        post(`${this.getAdminRoute()}/add_certificate`).
        set(this.defaultHeaders).
        accept('application/json').
        attach('certificate', file, file.name).
        end(this.handleResponse.bind(this, 'uploadCertificateFile', success, error));
    }

    removeCertificateFile(filename, success, error) {
        request.
        post(`${this.getAdminRoute()}/remove_certificate`).
        set(this.defaultHeaders).
        accept('application/json').
        send({filename}).
        end(this.handleResponse.bind(this, 'removeCertificateFile', success, error));
    }

    samlCertificateStatus(success, error) {
        request.get(`${this.getAdminRoute()}/saml_cert_status`).
        set(this.defaultHeaders).
        type('application/json').
        accept('application/json').
        end((err, res) => {
            if (err) {
                return error(err);
            }
            return success(res.body);
        });
    }
}
