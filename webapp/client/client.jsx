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

    getTeamNeededRoute(teamId = this.getTeamId()) {
        return `${this.url}${this.urlVersion}/teams/${teamId}`;
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

    getTeamFilesRoute() {
        return `${this.url}${this.urlVersion}/teams/${this.getTeamId()}/files`;
    }

    getFileRoute(fileId) {
        return `${this.url}${this.urlVersion}/files/${fileId}`;
    }

    getOAuthRoute() {
        return `${this.url}${this.urlVersion}/oauth`;
    }

    getUserNeededRoute(userId) {
        return `${this.url}${this.urlVersion}/users/${userId}`;
    }

    getWebrtcRoute() {
        return `${this.url}${this.urlVersion}/webrtc`;
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

    trackEvent(category, event, properties) { // eslint-disable-line no-unused-vars
        // NO-OP for inherited classes to override
    }

    handleError(err, res) { // eslint-disable-line no-unused-vars
        // NO-OP for inherited classes to override
    }

    handleSuccess(res) { // eslint-disable-line no-unused-vars
        // NO-OP for inherited classes to override
    }

    handleResponse(methodName, successCallback, errorCallback, err, res) {
        if (res && res.header) {
            if (res.header[HEADER_X_VERSION_ID]) {
                this.serverVersion = res.header[HEADER_X_VERSION_ID];
            }

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

            this.handleError(err, res);

            if (errorCallback) {
                errorCallback(e, err, res);
            }
            return;
        }

        if (successCallback) {
            if (res && res.body !== undefined) { // eslint-disable-line no-undefined
                successCallback(res.body, res);
            } else {
                console.error('Missing response body for ' + methodName); // eslint-disable-line no-console
                successCallback('', res);
            }
            this.handleSuccess(res);
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

    invalidateAllCaches(success, error) {
        return request.
            get(`${this.getAdminRoute()}/invalidate_all_caches`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'invalidate_all_caches', success, error));
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

        this.trackEvent('api', 'api_license_upload');
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

        this.trackEvent('api', 'api_admin_reset_password');
    }

    ldapSyncNow(success, error) {
        request.
            post(`${this.getAdminRoute()}/ldap_sync_now`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'ldapSyncNow', success, error));
    }

    ldapTest(success, error) {
        request.
            post(`${this.getAdminRoute()}/ldap_test`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'ldap_test', success, error));
    }

    // Team Routes Section

    findTeamByName(teamName, success, error) {
        request.
            post(`${this.getTeamsRoute()}/find_team_by_name`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({name: teamName}).
            end(this.handleResponse.bind(this, 'findTeamByName', success, error));
    }

    getTeamByName(teamName, success, error) {
        request.
            get(`${this.getTeamsRoute()}/name/${teamName}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getTeamByName', success, error));
    }

    createTeam(team, success, error) {
        request.
            post(`${this.getTeamsRoute()}/create`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(team).
            end(this.handleResponse.bind(this, 'createTeam', success, error));

        this.trackEvent('api', 'api_teams_create');
    }

    updateTeam(team, success, error) {
        request.
            post(`${this.getTeamNeededRoute()}/update`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(team).
            end(this.handleResponse.bind(this, 'updateTeam', success, error));

        this.trackEvent('api', 'api_teams_update_name', {team_id: this.getTeamId()});
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

    getTeamMembers(teamId, offset, limit, success, error) {
        request.
            get(`${this.getTeamNeededRoute(teamId)}/members/${offset}/${limit}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getTeamMembers', success, error));
    }

    getTeamMember(teamId, userId, success, error) {
        request.
            get(`${this.getTeamNeededRoute(teamId)}/members/${userId}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getTeamMember', success, error));
    }

    getMyTeamMembers(success, error) {
        request.
        get(`${this.getTeamsRoute()}/members`).
        set(this.defaultHeaders).
        type('application/json').
        accept('application/json').
        end(this.handleResponse.bind(this, 'getMyTeamMembers', success, error));
    }

    getMyTeamsUnread(teamId, success, error) {
        let url = `${this.getTeamsRoute()}/unread`;

        if (teamId) {
            url += `?id=${encodeURIComponent(teamId)}`;
        }

        request.
        get(url).
        set(this.defaultHeaders).
        type('application/json').
        accept('application/json').
        end(this.handleResponse.bind(this, 'getMyTeamsUnread', success, error));
    }

    getTeamMembersByIds(teamId, userIds, success, error) {
        request.
            post(`${this.getTeamNeededRoute(teamId)}/members/ids`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(userIds).
            end(this.handleResponse.bind(this, 'getTeamMembersByIds', success, error));
    }

    getTeamStats(teamId, success, error) {
        request.
            get(`${this.getTeamNeededRoute(teamId)}/stats`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getTeamStats', success, error));
    }

    inviteMembers(data, success, error) {
        request.
            post(`${this.getTeamNeededRoute()}/invite_members`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'inviteMembers', success, error));

        this.trackEvent('api', 'api_teams_invite_members', {team_id: this.getTeamId()});
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

        this.trackEvent('api', 'api_teams_invite_members', {team_id: nonEmptyTeamId});
    }

    addUserToTeamFromInvite(data, hash, inviteId, success, error) {
        request.
            post(`${this.getTeamsRoute()}/add_user_to_team_from_invite`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({hash, data, invite_id: inviteId}).
            end(this.handleResponse.bind(this, 'addUserToTeam', success, error));

        this.trackEvent('api', 'api_teams_invite_members');
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

        this.trackEvent('api', 'api_teams_remove_members', {team_id: nonEmptyTeamId});
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

        if (emailHash) {
            this.trackEvent('api', 'api_users_create_email');
        } else if (inviteId) {
            this.trackEvent('api', 'api_users_create_link');
        } else {
            this.trackEvent('api', 'api_users_create_spontaneous');
        }

        request.
            post(url).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(user).
            end(this.handleResponse.bind(this, 'createUser', success, error));

        this.trackEvent('api', 'api_users_create');
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
            this.trackEvent('api', 'api_users_update_' + type);
        } else {
            this.trackEvent('api', 'api_users_update');
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

        this.trackEvent('api', 'api_users_newpassword');
    }

    updateUserNotifyProps(notifyProps, success, error) {
        request.
            post(`${this.getUsersRoute()}/update_notify`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(notifyProps).
            end(this.handleResponse.bind(this, 'updateUserNotifyProps', success, error));

        this.trackEvent('api', 'api_users_update_notification_settings');
    }

    updateUserRoles(userId, newRoles, success, error) {
        var data = {
            new_roles: newRoles
        };

        request.
            post(`${this.getUserNeededRoute(userId)}/update_roles`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'updateUserRoles', success, error));

        this.trackEvent('api', 'api_users_update_roles');
    }

    updateTeamMemberRoles(teamId, userId, newRoles, success, error) {
        var data = {
            user_id: userId,
            new_roles: newRoles
        };

        request.
            post(`${this.getTeamNeededRoute(teamId)}/update_member_roles`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'updateTeamMemberRoles', success, error));

        this.trackEvent('api', 'api_teams_update_member_roles', {team_id: teamId});
    }

    updateActive(userId, active, success, error) {
        var data = {};
        data.user_id = userId;
        data.active = String(active);

        request.
            post(`${this.getUsersRoute()}/update_active`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'updateActive', success, error));

        this.trackEvent('api', 'api_users_update_active');
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

        this.trackEvent('api', 'api_users_send_password_reset');
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

        this.trackEvent('api', 'api_users_reset_password');
    }

    emailToOAuth(email, password, token, service, success, error) {
        request.
            post(`${this.getUsersRoute()}/claim/email_to_oauth`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({password, email, token, service}).
            end(this.handleResponse.bind(this, 'emailToOAuth', success, error));

        this.trackEvent('api', 'api_users_email_to_oauth');
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

        this.trackEvent('api', 'api_users_oauth_to_email');
    }

    emailToLdap(email, password, token, ldapId, ldapPassword, success, error) {
        var data = {};
        data.email_password = password;
        data.email = email;
        data.ldap_id = ldapId;
        data.ldap_password = ldapPassword;
        data.token = token;

        request.
            post(`${this.getUsersRoute()}/claim/email_to_ldap`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'emailToLdap', success, error));

        this.trackEvent('api', 'api_users_email_to_ldap');
    }

    ldapToEmail(email, emailPassword, token, ldapPassword, success, error) {
        var data = {};
        data.email = email;
        data.ldap_password = ldapPassword;
        data.email_password = emailPassword;
        data.token = token;

        request.
            post(`${this.getUsersRoute()}/claim/ldap_to_email`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'ldapToEmail', success, error));

        this.trackEvent('api', 'api_users_ldap_to_email');
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

    getUser(userId, success, error) {
        request.
            get(`${this.getUserNeededRoute(userId)}/get`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getUser', success, error));
    }

    getByUsername(userName, success, error) {
        request.
            get(`${this.getUsersRoute()}/name/${userName}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getByUsername', success, error));
    }

    getByEmail(email, success, error) {
        request.
            get(`${this.getUsersRoute()}/email/${email}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getByEmail', success, error));
    }

    login(loginId, password, mfaToken, success, error) {
        this.doLogin({login_id: loginId, password, token: mfaToken}, success, error);

        this.trackEvent('api', 'api_users_login');
    }

    loginById(id, password, mfaToken, success, error) {
        this.doLogin({id, password, token: mfaToken}, success, error);

        this.trackEvent('api', 'api_users_login');
    }

    loginByLdap(loginId, password, mfaToken, success, error) {
        this.doLogin({login_id: loginId, password, token: mfaToken, ldap_only: 'true'}, success, error);

        this.trackEvent('api', 'api_users_login');
        this.trackEvent('api', 'api_users_login_ldap');
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

        this.trackEvent('api', 'api_users_logout');
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

        this.trackEvent('api', 'api_users_oauth_to_email');
    }

    generateMfaSecret(success, error) {
        request.
            get(`${this.getUsersRoute()}/generate_mfa_secret`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'generateMfaSecret', success, error));
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

    getRecentlyActiveUsers(id, success, error) {
        request.
        get(`${this.getAdminRoute()}/recently_active_users/${id}`).
        set(this.defaultHeaders).
        type('application/json').
        accept('application/json').
        end(this.handleResponse.bind(this, 'getRecentlyActiveUsers', success, error));
    }

    getProfiles(offset, limit, success, error) {
        request.
            get(`${this.getUsersRoute()}/${offset}/${limit}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getProfiles', success, error));

        this.trackEvent('api', 'api_profiles_get');
    }

    getProfilesInTeam(teamId, offset, limit, success, error) {
        request.
            get(`${this.getTeamNeededRoute(teamId)}/users/${offset}/${limit}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getProfilesInTeam', success, error));

        this.trackEvent('api', 'api_profiles_get_in_team', {team_id: teamId});
    }

    getProfilesInChannel(channelId, offset, limit, success, error) {
        request.
            get(`${this.getChannelNeededRoute(channelId)}/users/${offset}/${limit}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getProfilesInChannel', success, error));

        this.trackEvent('api', 'api_profiles_get_in_channel', {team_id: this.getTeamId(), channel_id: channelId});
    }

    getProfilesNotInChannel(channelId, offset, limit, success, error) {
        request.
            get(`${this.getChannelNeededRoute(channelId)}/users/not_in_channel/${offset}/${limit}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getProfilesNotInChannel', success, error));

        this.trackEvent('api', 'api_profiles_get_not_in_channel', {team_id: this.getTeamId(), channel_id: channelId});
    }

    getProfilesWithoutTeam(page, perPage, success, error) {
        // Super hacky, but this option only exists in api v4
        function wrappedSuccess(data, res) {
            // Convert the profile list provided by api v4 to a map to match similar v3 calls
            const profiles = {};

            for (const profile of data) {
                profiles[profile.id] = profile;
            }

            success(profiles, res);
        }

        request.
            get(`${this.url}/api/v4/users?without_team=1&page=${page}&per_page=${perPage}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getProfilesWithoutTeam', wrappedSuccess, error));

        this.trackEvent('api', 'api_profiles_get_without_team');
    }

    getProfilesByIds(userIds, success, error) {
        request.
            post(`${this.getUsersRoute()}/ids`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(userIds).
            end(this.handleResponse.bind(this, 'getProfilesByIds', success, error));

        this.trackEvent('api', 'api_profiles_get_by_ids');
    }

    searchUsers(term, teamId, options, success, error) {
        request.
            post(`${this.getUsersRoute()}/search`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({term, team_id: teamId, ...options}).
            end(this.handleResponse.bind(this, 'searchUsers', success, error));
    }

    autocompleteUsersInChannel(term, channelId, success, error) {
        request.
            get(`${this.getChannelNeededRoute(channelId)}/users/autocomplete?term=${encodeURIComponent(term)}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'autocompleteUsersInChannel', success, error));
    }

    autocompleteUsersInTeam(term, success, error) {
        request.
            get(`${this.getTeamNeededRoute()}/users/autocomplete?term=${encodeURIComponent(term)}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'autocompleteUsersInTeam', success, error));
    }

    autocompleteUsers(term, success, error) {
        request.
            get(`${this.getUsersRoute()}/autocomplete?term=${encodeURIComponent(term)}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'autocompleteUsers', success, error));
    }

    getStatuses(success, error) {
        request.
            get(`${this.getUsersRoute()}/status`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getStatuses', success, error));
    }

    getStatusesByIds(userIds, success, error) {
        request.
            post(`${this.getUsersRoute()}/status/ids`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(userIds).
            end(this.handleResponse.bind(this, 'getStatuses', success, error));
    }

    // SCHEDULED FOR DEPRECATION IN 3.8 - use viewChannel instead
    setActiveChannel(id, success, error) {
        request.
            post(`${this.getUsersRoute()}/status/set_active_channel`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({channel_id: id}).
            end(this.handleResponse.bind(this, 'setActiveChannel', success, error));

        this.trackEvent('api', 'api_channels_set_active', {channel_id: id});
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

        this.trackEvent('api', 'api_users_update_profile_picture');
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

        this.trackEvent('api', 'api_channels_create', {team_id: this.getTeamId()});
    }

    createDirectChannel(userId, success, error) {
        request.
            post(`${this.getChannelsRoute()}/create_direct`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({user_id: userId}).
            end(this.handleResponse.bind(this, 'createDirectChannel', success, error));

        this.trackEvent('api', 'api_channels_create_direct', {team_id: this.getTeamId()});
    }

    createGroupChannel(userIds, success, error) {
        request.
            post(`${this.getChannelsRoute()}/create_group`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(userIds).
            end(this.handleResponse.bind(this, 'createGroupChannel', success, error));
    }

    updateChannel(channel, success, error) {
        request.
            post(`${this.getChannelsRoute()}/update`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(channel).
            end(this.handleResponse.bind(this, 'updateChannel', success, error));

        this.trackEvent('api', 'api_channels_update', {team_id: this.getTeamId(), channel_id: channel.id});
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

        this.trackEvent('api', 'api_channels_header', {team_id: this.getTeamId(), channel_id: channelId});
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

        this.trackEvent('api', 'api_channels_purpose', {team_id: this.getTeamId(), channel_id: channelId});
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

        this.trackEvent('api', 'api_channels_leave', {team_id: this.getTeamId(), channel_id: channelId});
    }

    joinChannel(channelId, success, error) {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/join`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'joinChannel', success, error));

        this.trackEvent('api', 'api_channels_join', {team_id: this.getTeamId(), channel_id: channelId});
    }

    joinChannelByName(name, success, error) {
        request.
            post(`${this.getChannelNameRoute(name)}/join`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'joinChannelByName', success, error));

        this.trackEvent('api', 'api_channels_join_name', {team_id: this.getTeamId()});
    }

    deleteChannel(channelId, success, error) {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/delete`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'deleteChannel', success, error));

        this.trackEvent('api', 'api_channels_delete', {team_id: this.getTeamId(), channel_id: channelId});
    }

    viewChannel(channelId, prevChannelId = '', time = 0, success, error) {
        request.
            post(`${this.getChannelsRoute()}/view`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({channel_id: channelId, prev_channel_id: prevChannelId, time}).
            end(this.handleResponse.bind(this, 'viewChannel', success, error));
    }

    // SCHEDULED FOR DEPRECATION IN 3.8 - use viewChannel instead
    updateLastViewedAt(channelId, active, success, error) {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/update_last_viewed_at`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({active}).
            end(this.handleResponse.bind(this, 'updateLastViewedAt', success, error));
    }

    // SCHEDULED FOR DEPRECATION IN 3.8
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

        this.trackEvent('api', 'api_channel_get', {team_id: this.getTeamId(), channel_id: channelId});
    }

    // SCHEDULED FOR DEPRECATION IN 3.7 - use getMoreChannelsPage instead
    getMoreChannels(success, error) {
        request.
            get(`${this.getChannelsRoute()}/more`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getMoreChannels', success, error));

        this.trackEvent('api', 'api_channels_more', {team_id: this.getTeamId()});
    }

    getMoreChannelsPage(offset, limit, success, error) {
        request.
            get(`${this.getChannelsRoute()}/more/${offset}/${limit}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getMoreChannelsPage', success, error));

        this.trackEvent('api', 'api_channels_more_page', {team_id: this.getTeamId()});
    }

    searchMoreChannels(term, success, error) {
        request.
            post(`${this.getChannelsRoute()}/more/search`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({term}).
            end(this.handleResponse.bind(this, 'searchMoreChannels', success, error));
    }

    autocompleteChannels(term, success, error) {
        request.
            get(`${this.getChannelsRoute()}/autocomplete?term=${encodeURIComponent(term)}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'autocompleteChannels', success, error));
    }

    getChannelCounts(success, error) {
        request.
            get(`${this.getChannelsRoute()}/counts`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getChannelCounts', success, error));
    }

    getMyChannelMembers(success, error) {
        request.
        get(`${this.getChannelsRoute()}/members`).
        set(this.defaultHeaders).
        type('application/json').
        accept('application/json').
        end(this.handleResponse.bind(this, 'getMyChannelMembers', success, error));
    }

    getMyChannelMembersForTeam(teamId, success, error) {
        request.
        get(`${this.getTeamsRoute()}/${teamId}/channels/members`).
        set(this.defaultHeaders).
        type('application/json').
        accept('application/json').
        end(this.handleResponse.bind(this, 'getMyChannelMembersForTeam', success, error));
    }

    getChannelByName(channelName, success, error) {
        request.
        get(`${this.getChannelsRoute()}/name/${channelName}`).
        set(this.defaultHeaders).
        type('application/json').
        accept('application/json').
        end(this.handleResponse.bind(this, 'getChannelByName', success, error));
    }

    getChannelStats(channelId, success, error) {
        request.
            get(`${this.getChannelNeededRoute(channelId)}/stats`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getChannelStats', success, error));
    }

    getChannelMember(channelId, userId, success, error) {
        request.
            get(`${this.getChannelNeededRoute(channelId)}/members/${userId}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getChannelMember', success, error));
    }

    getChannelMembersByIds(channelId, userIds, success, error) {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/members/ids`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(userIds).
            end(this.handleResponse.bind(this, 'getChannelMembersByIds', success, error));
    }

    addChannelMember(channelId, userId, success, error) {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/add`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({user_id: userId}).
            end(this.handleResponse.bind(this, 'addChannelMember', success, error));

        this.trackEvent('api', 'api_channels_add_member', {team_id: this.getTeamId(), channel_id: channelId});
    }

    removeChannelMember(channelId, userId, success, error) {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/remove`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({user_id: userId}).
            end(this.handleResponse.bind(this, 'removeChannelMember', success, error));

        this.trackEvent('api', 'api_channels_remove_member', {team_id: this.getTeamId(), channel_id: channelId});
    }

    updateChannelMemberRoles(channelId, userId, newRoles, success, error) {
        var data = {
            user_id: userId,
            new_roles: newRoles
        };

        request.
            post(`${this.getChannelNeededRoute(channelId)}/update_member_roles`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(data).
            end(this.handleResponse.bind(this, 'updateChannelMemberRoles', success, error));
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

    executeCommand(command, commandArgs, success, error) {
        request.
            post(`${this.getCommandsRoute()}/execute`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({command, ...commandArgs}).
            end(this.handleResponse.bind(this, 'executeCommand', success, error));

        this.trackEvent('api', 'api_integrations_used');
    }

    addCommand(command, success, error) {
        request.
            post(`${this.getCommandsRoute()}/create`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(command).
            end(this.handleResponse.bind(this, 'addCommand', success, error));

        this.trackEvent('api', 'api_integrations_created');
    }

    editCommand(command, success, error) {
        request.
            post(`${this.getCommandsRoute()}/update`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(command).
            end(this.handleResponse.bind(this, 'editCommand', success, error));

        this.trackEvent('api', 'api_integrations_created');
    }

    deleteCommand(commandId, success, error) {
        request.
            post(`${this.getCommandsRoute()}/delete`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({id: commandId}).
            end(this.handleResponse.bind(this, 'deleteCommand', success, error));

        this.trackEvent('api', 'api_integrations_deleted');
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
            send({...post, create_at: 0}).
            end(this.handleResponse.bind(this, 'createPost', success, error));

        this.trackEvent('api', 'api_posts_create', {team_id: this.getTeamId(), channel_id: post.channel_id});

        if (post.parent_id != null && post.parent_id !== '') {
            this.trackEvent('api', 'api_posts_replied', {team_id: this.getTeamId(), channel_id: post.channel_id});
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

        this.trackEvent('api', 'api_channels_permalink', {team_id: this.getTeamId()});
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

        this.trackEvent('api', 'api_posts_update', {team_id: this.getTeamId(), channel_id: post.channel_id});
    }

    deletePost(channelId, postId, success, error) {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/posts/${postId}/delete`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'deletePost', success, error));

        this.trackEvent('api', 'api_posts_delete', {team_id: this.getTeamId(), channel_id: channelId});
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

        this.trackEvent('api', 'api_posts_search', {team_id: this.getTeamId()});
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

        this.trackEvent('api', 'api_posts_get_before', {team_id: this.getTeamId(), channel_id: channelId});
    }

    getPostsAfter(channelId, postId, offset, numPost, success, error) {
        request.
            get(`${this.getPostsRoute(channelId)}/${postId}/after/${offset}/${numPost}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPostsAfter', success, error));

        this.trackEvent('api', 'api_posts_get_after', {team_id: this.getTeamId(), channel_id: channelId});
    }

    getFlaggedPosts(offset, limit, success, error) {
        request.
            get(`${this.getTeamNeededRoute()}/posts/flagged/${offset}/${limit}`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getFlaggedPosts', success, error));

        this.trackEvent('api', 'api_posts_get_flagged', {team_id: this.getTeamId()});
    }

    getPinnedPosts(channelId, success, error) {
        request.
            get(`${this.getChannelNeededRoute(channelId)}/pinned`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPinnedPosts', success, error));
    }

    getFileInfosForPost(channelId, postId, success, error) {
        request.
            get(`${this.getChannelNeededRoute(channelId)}/posts/${postId}/get_file_infos`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getFileInfosForPost', success, error));
    }

    getOpenGraphMetadata(url, success, error) {
        request.
            post(`${this.getBaseRoute()}/get_opengraph_metadata`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({url}).
            end(this.handleResponse.bind(this, 'getOpenGraphMetadata', success, error));
    }

    // Routes for Files

    uploadFile(file, filename, channelId, clientId, success, error) {
        this.trackEvent('api', 'api_files_upload', {team_id: this.getTeamId(), channel_id: channelId});

        return request.
            post(`${this.getTeamFilesRoute()}/upload`).
            set(this.defaultHeaders).
            attach('files', file, filename).
            field('channel_id', channelId).
            field('client_ids', clientId).
            accept('application/json').
            end(this.handleResponse.bind(this, 'uploadFile', success, error));
    }

    getFile(fileId, success, error) {
        request.
            get(`${this.getFileRoute(fileId)}/get`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getFile', success, error));
    }

    getFileThumbnail(fileId, success, error) {
        request.
            get(`${this.getFileRoute(fileId)}/get_thumbnail`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getFileThumbnail', success, error));
    }

    getFilePreview(fileId, success, error) {
        request.
            get(`${this.getFileRoute(fileId)}/get`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getFilePreview', success, error));
    }

    getFileInfo(fileId, success, error) {
        request.
            get(`${this.getFileRoute(fileId)}/get_info`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getFileInfo', success, error));
    }

    getPublicLink(fileId, success, error) {
        request.
            get(`${this.getFileRoute(fileId)}/get_public_link`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'getPublicLink', success, error));
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

        this.trackEvent('api', 'api_apps_register');
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

        this.trackEvent('api', 'api_apps_delete');
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

    getAuthorizedApps(success, error) {
        request.
        get(`${this.getOAuthRoute()}/authorized`).
        set(this.defaultHeaders).
        type('application/json').
        accept('application/json').
        send().
        end(this.handleResponse.bind(this, 'getAuthorizedApps', success, error));
    }

    deauthorizeOAuthApp(id, success, error) {
        request.
        post(`${this.getOAuthRoute()}/${id}/deauthorize`).
        set(this.defaultHeaders).
        type('application/json').
        accept('application/json').
        send().
        end(this.handleResponse.bind(this, 'deauthorizeOAuthApp', success, error));
    }

    regenerateOAuthAppSecret(id, success, error) {
        request.
        post(`${this.getOAuthRoute()}/${id}/regen_secret`).
        set(this.defaultHeaders).
        type('application/json').
        accept('application/json').
        send().
        end(this.handleResponse.bind(this, 'regenerateOAuthAppSecret', success, error));
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

        this.trackEvent('api', 'api_integrations_created', {team_id: this.getTeamId()});
    }

    updateIncomingHook(hook, success, error) {
        request.
            post(`${this.getHooksRoute()}/incoming/update`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(hook).
            end(this.handleResponse.bind(this, 'updateIncomingHook', success, error));

        this.trackEvent('api', 'api_integrations_updated', {team_id: this.getTeamId()});
    }

    deleteIncomingHook(hookId, success, error) {
        request.
            post(`${this.getHooksRoute()}/incoming/delete`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({id: hookId}).
            end(this.handleResponse.bind(this, 'deleteIncomingHook', success, error));

        this.trackEvent('api', 'api_integrations_deleted', {team_id: this.getTeamId()});
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

        this.trackEvent('api', 'api_integrations_created', {team_id: this.getTeamId()});
    }

    updateOutgoingHook(hook, success, error) {
        request.
            post(`${this.getHooksRoute()}/outgoing/update`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(hook).
            end(this.handleResponse.bind(this, 'updateOutgoingHook', success, error));

        this.trackEvent('api', 'api_integrations_updated', {team_id: this.getTeamId()});
    }

    deleteOutgoingHook(hookId, success, error) {
        request.
            post(`${this.getHooksRoute()}/outgoing/delete`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({id: hookId}).
            end(this.handleResponse.bind(this, 'deleteOutgoingHook', success, error));

        this.trackEvent('api', 'api_integrations_deleted', {team_id: this.getTeamId()});
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

        this.trackEvent('api', 'api_emoji_custom_add');
    }

    deleteEmoji(id, success, error) {
        request.
            post(`${this.getEmojiRoute()}/delete`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send({id}).
            end(this.handleResponse.bind(this, 'deleteEmoji', success, error));

        this.trackEvent('api', 'api_emoji_custom_delete');
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

            if (!res.body) {
                console.error('Missing response body for samlCertificateStatus'); // eslint-disable-line no-console
            }

            return success(res.body);
        });
    }

    pinPost(channelId, postId, success, error) {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/posts/${postId}/pin`).
            set(this.defaultHeaders).
            accept('application/json').
            send().
            end(this.handleResponse.bind(this, 'pinPost', success, error));
    }

    unpinPost(channelId, postId, success, error) {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/posts/${postId}/unpin`).
            set(this.defaultHeaders).
            accept('application/json').
            send().
            end(this.handleResponse.bind(this, 'unpinPost', success, error));
    }

    saveReaction(channelId, reaction, success, error) {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/posts/${reaction.post_id}/reactions/save`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(reaction).
            end(this.handleResponse.bind(this, 'saveReaction', success, error));

        this.trackEvent('api', 'api_reactions_save', {team_id: this.getTeamId(), channel_id: channelId, post_id: reaction.post_id});
    }

    deleteReaction(channelId, reaction, success, error) {
        request.
            post(`${this.getChannelNeededRoute(channelId)}/posts/${reaction.post_id}/reactions/delete`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            send(reaction).
            end(this.handleResponse.bind(this, 'deleteReaction', success, error));

        this.trackEvent('api', 'api_reactions_delete', {team_id: this.getTeamId(), channel_id: channelId, post_id: reaction.post_id});
    }

    listReactions(channelId, postId, success, error) {
        request.
            get(`${this.getChannelNeededRoute(channelId)}/posts/${postId}/reactions`).
            set(this.defaultHeaders).
            type('application/json').
            accept('application/json').
            end(this.handleResponse.bind(this, 'listReactions', success, error));
    }

    webrtcToken(success, error) {
        request.post(`${this.getWebrtcRoute()}/token`).
        set(this.defaultHeaders).
        type('application/json').
        accept('application/json').
        end(this.handleResponse.bind(this, 'webrtcToken', success, error));
    }
}
