// See License.txt for license information.

import BrowserStore from '../stores/browser_store.jsx';

import {browserHistory} from 'react-router';

let translations = {
    connectionError: 'There appears to be a problem with your internet connection.',
    unknownError: 'We received an unexpected status code from the server.'
};

export function setTranslations(messages) {
    translations = messages;
}

export function track(category, action, label, property, value) {
    global.window.analytics.track(action, {category, label, property, value});
}

export function trackPage() {
    global.window.analytics.page();
}

function handleError(methodName, xhr, status, err) {
    var e = null;
    try {
        e = JSON.parse(xhr.responseText);
    } catch (parseError) {
        e = null;
    }

    var msg = '';

    if (e) {
        msg = 'method=' + methodName + ' msg=' + e.message + ' detail=' + e.detailed_error + ' rid=' + e.request_id;
    } else {
        msg = 'method=' + methodName + ' status=' + status + ' statusCode=' + xhr.status + ' err=' + err;

        if (xhr.status === 0) {
            e = {message: translations.connectionError};
        } else {
            e = {message: translations.unknownError + ' (' + xhr.status + ')'};
        }
    }

    console.error(msg); //eslint-disable-line no-console
    console.error(e); //eslint-disable-line no-console

    track('api', 'api_weberror', methodName, 'message', msg);

    if (xhr.status === 401) {
        if (window.location.href.indexOf('/channels') === 0) {
            browserHistory.push('/login?extra=expired&redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
        } else {
            var teamURL = window.location.pathname.split('/channels')[0];
            browserHistory.push(teamURL + '/login?extra=expired&redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
        }
    }

    return e;
}

export function getTranslations(locale, success, error) {
    $.ajax({
        url: '/static/i18n/' + locale + '.json',
        dataType: 'json',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getTranslations', xhr, status, err);
            error(e);
        }
    });
}

export function createTeamFromSignup(teamSignup, success, error) {
    $.ajax({
        url: '/api/v1/teams/create_from_signup',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(teamSignup),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('createTeamFromSignup', xhr, status, err);
            error(e);
        }
    });
}

export function createTeamWithLdap(teamSignup, success, error) {
    $.ajax({
        url: '/api/v1/teams/create_with_ldap',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(teamSignup),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('createTeamFromSignup', xhr, status, err);
            error(e);
        }
    });
}

export function createTeamWithSSO(team, service, success, error) {
    $.ajax({
        url: '/api/v1/teams/create_with_sso/' + service,
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(team),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('createTeamWithSSO', xhr, status, err);
            error(e);
        }
    });
}

export function createUser(user, data, emailHash, success, error) {
    $.ajax({
        url: '/api/v1/users/create?d=' + encodeURIComponent(data) + '&h=' + encodeURIComponent(emailHash),
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(user),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('createUser', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_users_create', user.team_id, 'email', user.email);
}

export function updateUser(user, success, error) {
    $.ajax({
        url: '/api/v1/users/update',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(user),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('updateUser', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_users_update');
}

export function updatePassword(data, success, error) {
    $.ajax({
        url: '/api/v1/users/newpassword',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('newPassword', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_users_newpassword');
}

export function updateUserNotifyProps(data, success, error) {
    $.ajax({
        url: '/api/v1/users/update_notify',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('updateUserNotifyProps', xhr, status, err);
            error(e);
        }
    });
}

export function updateRoles(data, success, error) {
    $.ajax({
        url: '/api/v1/users/update_roles',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('updateRoles', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_users_update_roles');
}

export function updateActive(userId, active, success, error) {
    var data = {};
    data.user_id = userId;
    data.active = '' + active;

    $.ajax({
        url: '/api/v1/users/update_active',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('updateActive', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_users_update_roles');
}

export function sendPasswordReset(data, success, error) {
    $.ajax({
        url: '/api/v1/users/send_password_reset',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('sendPasswordReset', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_users_send_password_reset');
}

export function resetPassword(data, success, error) {
    $.ajax({
        url: '/api/v1/users/reset_password',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('resetPassword', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_users_reset_password');
}

export function switchToSSO(data, success, error) {
    $.ajax({
        url: '/api/v1/users/switch_to_sso',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('switchToSSO', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_users_switch_to_sso');
}

export function switchToEmail(data, success, error) {
    $.ajax({
        url: '/api/v1/users/switch_to_email',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('switchToEmail', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_users_switch_to_email');
}

export function logout(success, error) {
    track('api', 'api_users_logout');
    $.ajax({
        url: '/api/v1/users/logout',
        type: 'POST',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('logout', xhr, status, err);
            error(e);
        }
    });
}

export function loginByEmail(name, email, password, success, error) {
    $.ajax({
        url: '/api/v1/users/login',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify({name, email, password}),
        success: function onSuccess(data, textStatus, xhr) {
            track('api', 'api_users_login_success', data.team_id, 'email', data.email);
            sessionStorage.removeItem(data.id + '_last_error');
            BrowserStore.signalLogin();
            success(data, textStatus, xhr);
        },
        error: function onError(xhr, status, err) {
            track('api', 'api_users_login_fail', name, 'email', email);

            var e = handleError('loginByEmail', xhr, status, err);
            error(e);
        }
    });
}

export function loginByUsername(name, username, password, success, error) {
    $.ajax({
        url: '/api/v1/users/login',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify({name, username, password}),
        success: function onSuccess(data, textStatus, xhr) {
            track('api', 'api_users_login_success', data.team_id, 'username', data.username);
            sessionStorage.removeItem(data.id + '_last_error');
            BrowserStore.signalLogin();
            success(data, textStatus, xhr);
        },
        error: function onError(xhr, status, err) {
            track('api', 'api_users_login_fail', name, 'username', username);

            var e = handleError('loginByUsername', xhr, status, err);
            error(e);
        }
    });
}

export function loginByLdap(teamName, id, password, success, error) {
    $.ajax({
        url: '/api/v1/users/login_ldap',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify({teamName, id, password}),
        success: function onSuccess(data, textStatus, xhr) {
            track('api', 'api_users_loginLdap_success', data.team_id, 'id', id);
            sessionStorage.removeItem(data.id + '_last_error');
            BrowserStore.signalLogin();
            success(data, textStatus, xhr);
        },
        error: function onError(xhr, status, err) {
            track('api', 'api_users_loginLdap_fail', teamName, 'id', id);

            var e = handleError('loginByLdap', xhr, status, err);
            error(e);
        }
    });
}

export function revokeSession(altId, success, error) {
    $.ajax({
        url: '/api/v1/users/revoke_session',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify({id: altId}),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('revokeSession', xhr, status, err);
            error(e);
        }
    });
}

export function getSessions(userId, success, error) {
    $.ajax({
        cache: false,
        url: '/api/v1/users/' + userId + '/sessions',
        dataType: 'json',
        contentType: 'application/json',
        type: 'GET',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getSessions', xhr, status, err);
            error(e);
        }
    });
}

export function getAudits(userId, success, error) {
    $.ajax({
        url: '/api/v1/users/' + userId + '/audits',
        dataType: 'json',
        contentType: 'application/json',
        type: 'GET',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getAudits', xhr, status, err);
            error(e);
        }
    });
}

export function getLogs(success, error) {
    $.ajax({
        url: '/api/v1/admin/logs',
        dataType: 'json',
        contentType: 'application/json',
        type: 'GET',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getLogs', xhr, status, err);
            error(e);
        }
    });
}

export function getServerAudits(success, error) {
    $.ajax({
        url: '/api/v1/admin/audits',
        dataType: 'json',
        contentType: 'application/json',
        type: 'GET',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getServerAudits', xhr, status, err);
            error(e);
        }
    });
}

export function getConfig(success, error) {
    return $.ajax({
        url: '/api/v1/admin/config',
        dataType: 'json',
        contentType: 'application/json',
        type: 'GET',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getConfig', xhr, status, err);
            error(e);
        }
    });
}

export function getAnalytics(name, teamId, success, error) {
    let url = '/api/v1/admin/analytics/';
    if (teamId == null) {
        url += name;
    } else {
        url += teamId + '/' + name;
    }
    $.ajax({
        url,
        dataType: 'json',
        contentType: 'application/json',
        type: 'GET',
        success,
        error: (xhr, status, err) => {
            var e = handleError('getSystemAnalytics', xhr, status, err);
            error(e);
        }
    });
}

export function getClientConfig(success, error) {
    return $.ajax({
        url: '/api/v1/admin/client_props',
        dataType: 'json',
        contentType: 'application/json',
        type: 'GET',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getClientConfig', xhr, status, err);
            error(e);
        }
    });
}

export function getTeamAnalytics(teamId, name, success, error) {
    $.ajax({
        url: '/api/v1/admin/analytics/' + teamId + '/' + name,
        dataType: 'json',
        contentType: 'application/json',
        type: 'GET',
        success,
        error: (xhr, status, err) => {
            var e = handleError('getTeamAnalytics', xhr, status, err);
            error(e);
        }
    });
}

export function saveConfig(config, success, error) {
    $.ajax({
        url: '/api/v1/admin/save_config',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(config),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('saveConfig', xhr, status, err);
            error(e);
        }
    });
}

export function logClientError(msg) {
    var l = {};
    l.level = 'ERROR';
    l.message = msg;

    $.ajax({
        url: '/api/v1/admin/log_client',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(l)
    });
}

export function testEmail(config, success, error) {
    $.ajax({
        url: '/api/v1/admin/test_email',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(config),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('testEmail', xhr, status, err);
            error(e);
        }
    });
}

export function getAllTeams(success, error) {
    $.ajax({
        url: '/api/v1/teams/all',
        dataType: 'json',
        contentType: 'application/json',
        type: 'GET',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getAllTeams', xhr, status, err);
            error(e);
        }
    });
}

export function getMeLoggedIn(success, error) {
    return $.ajax({
        cache: false,
        url: '/api/v1/users/me_logged_in',
        dataType: 'json',
        contentType: 'application/json',
        type: 'GET',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getMeLoggedIn', xhr, status, err);
            error(e);
        }
    });
}

export function getMe(success, error) {
    var currentUser = null;
    $.ajax({
        cache: false,
        url: '/api/v1/users/me',
        dataType: 'json',
        contentType: 'application/json',
        type: 'GET',
        success: function gotUser(data, textStatus, xhr) {
            currentUser = data;
            if (success) {
                success(data, textStatus, xhr);
            }
        },
        error: function onError(xhr, status, err) {
            if (error) {
                var e = handleError('getMe', xhr, status, err);
                error(e);
            }
        }
    });

    return currentUser;
}

export function inviteMembers(data, success, error) {
    $.ajax({
        url: '/api/v1/teams/invite_members',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('inviteMembers', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_teams_invite_members');
}

export function updateTeam(team, success, error) {
    $.ajax({
        url: '/api/v1/teams/update',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(team),
        success,
        error: (xhr, status, err) => {
            var e = handleError('updateTeam', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_teams_update_name');
}

export function signupTeam(email, success, error) {
    $.ajax({
        url: '/api/v1/teams/signup',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify({email: email}),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('singupTeam', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_teams_signup');
}

export function createTeam(team, success, error) {
    $.ajax({
        url: '/api/v1/teams/create',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(team),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('createTeam', xhr, status, err);
            error(e);
        }
    });
}

export function findTeamByName(teamName, success, error) {
    $.ajax({
        url: '/api/v1/teams/find_team_by_name',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify({name: teamName}),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('findTeamByName', xhr, status, err);
            error(e);
        }
    });
}

export function createChannel(channel, success, error) {
    $.ajax({
        url: '/api/v1/channels/create',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(channel),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('createChannel', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_channels_create', channel.type, 'name', channel.name);
}

export function createDirectChannel(channel, userId, success, error) {
    $.ajax({
        url: '/api/v1/channels/create_direct',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify({user_id: userId}),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('createDirectChannel', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_channels_create_direct', channel.type, 'name', channel.name);
}

export function updateChannel(channel, success, error) {
    $.ajax({
        url: '/api/v1/channels/update',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(channel),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('updateChannel', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_channels_update');
}

export function updateChannelHeader(channelId, header, success, error) {
    const data = {
        channel_id: channelId,
        channel_header: header
    };

    $.ajax({
        url: '/api/v1/channels/update_header',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('updateChannelHeader', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_channels_header');
}

export function updateChannelPurpose(data, success, error) {
    $.ajax({
        url: '/api/v1/channels/update_purpose',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('updateChannelPurpose', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_channels_purpose');
}

export function updateNotifyProps(data, success, error) {
    $.ajax({
        url: '/api/v1/channels/update_notify_props',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('updateNotifyProps', xhr, status, err);
            error(e);
        }
    });
}

export function joinChannel(id, success, error) {
    $.ajax({
        url: '/api/v1/channels/' + id + '/join',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('joinChannel', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_channels_join');
}

export function leaveChannel(id, success, error) {
    $.ajax({
        url: '/api/v1/channels/' + id + '/leave',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('leaveChannel', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_channels_leave');
}

export function deleteChannel(id, success, error) {
    $.ajax({
        url: '/api/v1/channels/' + id + '/delete',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('deleteChannel', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_channels_delete');
}

export function updateLastViewedAt(channelId, success, error) {
    $.ajax({
        url: '/api/v1/channels/' + channelId + '/update_last_viewed_at',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('updateLastViewedAt', xhr, status, err);
            error(e);
        }
    });
}

export function getChannels(success, error) {
    return $.ajax({
        cache: false,
        url: '/api/v1/channels/',
        dataType: 'json',
        type: 'GET',
        success,
        ifModified: true,
        error: function onError(xhr, status, err) {
            var e = handleError('getChannels', xhr, status, err);
            error(e);
        }
    });
}

export function getChannel(id, success, error) {
    $.ajax({
        cache: false,
        url: '/api/v1/channels/' + id + '/',
        dataType: 'json',
        type: 'GET',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getChannel', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_channel_get');
}

export function getMoreChannels(success, error) {
    $.ajax({
        url: '/api/v1/channels/more',
        dataType: 'json',
        type: 'GET',
        success,
        ifModified: true,
        error: function onError(xhr, status, err) {
            var e = handleError('getMoreChannels', xhr, status, err);
            error(e);
        }
    });
}

export function getChannelCounts(success, error) {
    $.ajax({
        cache: false,
        url: '/api/v1/channels/counts',
        dataType: 'json',
        type: 'GET',
        success,
        ifModified: true,
        error: function onError(xhr, status, err) {
            var e = handleError('getChannelCounts', xhr, status, err);
            error(e);
        }
    });
}

export function getChannelExtraInfo(id, memberLimit, success, error) {
    let url = '/api/v1/channels/' + id + '/extra_info';

    if (memberLimit) {
        url += '/' + memberLimit;
    }

    return $.ajax({
        url,
        dataType: 'json',
        contentType: 'application/json',
        type: 'GET',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getChannelExtraInfo', xhr, status, err);
            error(e);
        }
    });
}

export function executeCommand(channelId, command, suggest, success, error) {
    $.ajax({
        url: '/api/v1/commands/execute',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify({channelId, command, suggest: '' + suggest}),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('executeCommand', xhr, status, err);
            error(e);
        }
    });
}

export function addCommand(cmd, success, error) {
    $.ajax({
        url: '/api/v1/commands/create',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(cmd),
        success,
        error: (xhr, status, err) => {
            var e = handleError('addCommand', xhr, status, err);
            error(e);
        }
    });
}

export function deleteCommand(data, success, error) {
    $.ajax({
        url: '/api/v1/commands/delete',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: (xhr, status, err) => {
            var e = handleError('deleteCommand', xhr, status, err);
            error(e);
        }
    });
}

export function listTeamCommands(success, error) {
    $.ajax({
        url: '/api/v1/commands/list_team_commands',
        dataType: 'json',
        type: 'GET',
        success,
        error: (xhr, status, err) => {
            var e = handleError('listTeamCommands', xhr, status, err);
            error(e);
        }
    });
}

export function regenCommandToken(data, success, error) {
    $.ajax({
        url: '/api/v1/commands/regen_token',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: (xhr, status, err) => {
            var e = handleError('regenCommandToken', xhr, status, err);
            error(e);
        }
    });
}

export function listCommands(success, error) {
    $.ajax({
        url: '/api/v1/commands/list',
        dataType: 'json',
        contentType: 'application/json',
        type: 'GET',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('listCommands', xhr, status, err);
            error(e);
        }
    });
}

export function getPostsPage(channelId, offset, limit, success, error, complete) {
    $.ajax({
        cache: false,
        url: '/api/v1/channels/' + channelId + '/posts/' + offset + '/' + limit,
        dataType: 'json',
        type: 'GET',
        ifModified: true,
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getPosts', xhr, status, err);
            error(e);
        },
        complete: complete
    });
}

export function getPosts(channelId, since, success, error, complete) {
    return $.ajax({
        url: '/api/v1/channels/' + channelId + '/posts/' + since,
        dataType: 'json',
        type: 'GET',
        ifModified: true,
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getPosts', xhr, status, err);
            error(e);
        },
        complete: complete
    });
}

export function getPostsBefore(channelId, post, offset, numPost, success, error, complete) {
    $.ajax({
        url: '/api/v1/channels/' + channelId + '/post/' + post + '/before/' + offset + '/' + numPost,
        dataType: 'json',
        type: 'GET',
        ifModified: false,
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getPostsBefore', xhr, status, err);
            error(e);
        },
        complete: complete
    });
}

export function getPostsAfter(channelId, post, offset, numPost, success, error, complete) {
    $.ajax({
        url: '/api/v1/channels/' + channelId + '/post/' + post + '/after/' + offset + '/' + numPost,
        dataType: 'json',
        type: 'GET',
        ifModified: false,
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getPostsAfter', xhr, status, err);
            error(e);
        },
        complete: complete
    });
}

export function getPost(channelId, postId, success, error, complete) {
    $.ajax({
        cache: false,
        url: '/api/v1/channels/' + channelId + '/post/' + postId,
        dataType: 'json',
        type: 'GET',
        ifModified: false,
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getPost', xhr, status, err);
            error(e);
        },
        complete
    });
}

export function getPostById(postId, success, error, complete) {
    $.ajax({
        cache: false,
        url: '/api/v1/posts/' + postId,
        dataType: 'json',
        type: 'GET',
        ifModified: false,
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getPostById', xhr, status, err);
            error(e);
        },
        complete
    });
}

export function search(terms, success, error) {
    $.ajax({
        url: '/api/v1/posts/search',
        dataType: 'json',
        type: 'GET',
        data: {terms: terms},
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('search', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_posts_search');
}

export function deletePost(channelId, id, success, error) {
    $.ajax({
        url: '/api/v1/channels/' + channelId + '/post/' + id + '/delete',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('deletePost', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_posts_delete');
}

export function createPost(post, channel, success, error) {
    $.ajax({
        url: '/api/v1/channels/' + post.channel_id + '/create',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(post),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('createPost', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_posts_create', channel.name, 'length', post.message.length);

    // global.window.analytics.track('api_posts_create', {
    //     category: 'api',
    //     channel_name: channel.name,
    //     channel_type: channel.type,
    //     length: post.message.length,
    //     files: (post.filenames || []).length,
    //     mentions: (post.message.match('/<mention>/g') || []).length
    // });
}

export function updatePost(post, success, error) {
    $.ajax({
        url: '/api/v1/channels/' + post.channel_id + '/update',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(post),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('updatePost', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_posts_update');
}

export function addChannelMember(id, data, success, error) {
    $.ajax({
        url: '/api/v1/channels/' + id + '/add',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('addChannelMember', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_channels_add_member');
}

export function removeChannelMember(id, data, success, error) {
    $.ajax({
        url: '/api/v1/channels/' + id + '/remove',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('removeChannelMember', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_channels_remove_member');
}

export function getProfiles(success, error) {
    $.ajax({
        cache: false,
        url: '/api/v1/users/profiles',
        dataType: 'json',
        contentType: 'application/json',
        type: 'GET',
        success,
        ifModified: true,
        error: function onError(xhr, status, err) {
            var e = handleError('getProfiles', xhr, status, err);
            error(e);
        }
    });
}

export function getProfilesForTeam(teamId, success, error) {
    $.ajax({
        cache: false,
        url: '/api/v1/users/profiles/' + teamId,
        dataType: 'json',
        contentType: 'application/json',
        type: 'GET',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getProfilesForTeam', xhr, status, err);
            error(e);
        }
    });
}

export function uploadFile(formData, success, error) {
    var request = $.ajax({
        url: '/api/v1/files/upload',
        type: 'POST',
        data: formData,
        cache: false,
        contentType: false,
        processData: false,
        success,
        error: function onError(xhr, status, err) {
            if (err !== 'abort') {
                var e = handleError('uploadFile', xhr, status, err);
                error(e);
            }
        }
    });

    track('api', 'api_files_upload');

    return request;
}

export function getFileInfo(filename, success, error) {
    $.ajax({
        url: '/api/v1/files/get_info' + filename,
        dataType: 'json',
        contentType: 'application/json',
        type: 'GET',
        success: (data) => {
            success(data);
        },
        error: function onError(xhr, status, err) {
            var e = handleError('getFileInfo', xhr, status, err);
            error(e);
        }
    });
}

export function getPublicLink(data, success, error) {
    $.ajax({
        url: '/api/v1/files/get_public_link',
        dataType: 'json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getPublicLink', xhr, status, err);
            error(e);
        }
    });
}

export function uploadProfileImage(imageData, success, error) {
    $.ajax({
        url: '/api/v1/users/newimage',
        type: 'POST',
        data: imageData,
        cache: false,
        contentType: false,
        processData: false,
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('uploadProfileImage', xhr, status, err);
            error(e);
        }
    });
}

export function importSlack(fileData, success, error) {
    $.ajax({
        url: '/api/v1/teams/import_team',
        type: 'POST',
        data: fileData,
        cache: false,
        contentType: false,
        processData: false,
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('importTeam', xhr, status, err);
            error(e);
        }
    });
}

export function exportTeam(success, error) {
    $.ajax({
        url: '/api/v1/teams/export_team',
        type: 'GET',
        dataType: 'json',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('exportTeam', xhr, status, err);
            error(e);
        }
    });
}

export function getStatuses(ids, success, error) {
    $.ajax({
        url: '/api/v1/users/status',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(ids),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getStatuses', xhr, status, err);
            error(e);
        }
    });
}

export function getMyTeam(success, error) {
    return $.ajax({
        url: '/api/v1/teams/me',
        dataType: 'json',
        type: 'GET',
        success,
        ifModified: true,
        error: function onError(xhr, status, err) {
            var e = handleError('getMyTeam', xhr, status, err);
            error(e);
        }
    });
}

export function registerOAuthApp(app, success, error) {
    $.ajax({
        url: '/api/v1/oauth/register',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(app),
        success: success,
        error: (xhr, status, err) => {
            const e = handleError('registerApp', xhr, status, err);
            error(e);
        }
    });

    module.exports.track('api', 'api_apps_register');
}

export function allowOAuth2(responseType, clientId, redirectUri, state, scope, success, error) {
    $.ajax({
        url: '/api/v1/oauth/allow?response_type=' + responseType + '&client_id=' + clientId + '&redirect_uri=' + redirectUri + '&scope=' + scope + '&state=' + state,
        dataType: 'json',
        contentType: 'application/json',
        type: 'GET',
        success,
        error: (xhr, status, err) => {
            const e = handleError('allowOAuth2', xhr, status, err);
            error(e);
        }
    });

    module.exports.track('api', 'api_users_allow_oauth2');
}

export function addIncomingHook(hook, success, error) {
    $.ajax({
        url: '/api/v1/hooks/incoming/create',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(hook),
        success,
        error: (xhr, status, err) => {
            var e = handleError('addIncomingHook', xhr, status, err);
            error(e);
        }
    });
}

export function deleteIncomingHook(data, success, error) {
    $.ajax({
        url: '/api/v1/hooks/incoming/delete',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: (xhr, status, err) => {
            var e = handleError('deleteIncomingHook', xhr, status, err);
            error(e);
        }
    });
}

export function listIncomingHooks(success, error) {
    $.ajax({
        url: '/api/v1/hooks/incoming/list',
        dataType: 'json',
        type: 'GET',
        success,
        error: (xhr, status, err) => {
            var e = handleError('listIncomingHooks', xhr, status, err);
            error(e);
        }
    });
}

export function getAllPreferences(success, error) {
    return $.ajax({
        url: '/api/v1/preferences/',
        dataType: 'json',
        type: 'GET',
        success,
        error: (xhr, status, err) => {
            var e = handleError('getAllPreferences', xhr, status, err);
            error(e);
        }
    });
}

export function getPreferenceCategory(category, success, error) {
    $.ajax({
        url: `/api/v1/preferences/${category}`,
        dataType: 'json',
        type: 'GET',
        success,
        error: (xhr, status, err) => {
            var e = handleError('getPreferenceCategory', xhr, status, err);
            error(e);
        }
    });
}

export function savePreferences(preferences, success, error) {
    $.ajax({
        url: '/api/v1/preferences/save',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(preferences),
        success,
        error: (xhr, status, err) => {
            var e = handleError('savePreferences', xhr, status, err);
            error(e);
        }
    });
}

export function addOutgoingHook(hook, success, error) {
    $.ajax({
        url: '/api/v1/hooks/outgoing/create',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(hook),
        success,
        error: (xhr, status, err) => {
            var e = handleError('addOutgoingHook', xhr, status, err);
            error(e);
        }
    });
}

export function deleteOutgoingHook(data, success, error) {
    $.ajax({
        url: '/api/v1/hooks/outgoing/delete',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: (xhr, status, err) => {
            var e = handleError('deleteOutgoingHook', xhr, status, err);
            error(e);
        }
    });
}

export function listOutgoingHooks(success, error) {
    $.ajax({
        url: '/api/v1/hooks/outgoing/list',
        dataType: 'json',
        type: 'GET',
        success,
        error: (xhr, status, err) => {
            var e = handleError('listOutgoingHooks', xhr, status, err);
            error(e);
        }
    });
}

export function regenOutgoingHookToken(data, success, error) {
    $.ajax({
        url: '/api/v1/hooks/outgoing/regen_token',
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: JSON.stringify(data),
        success,
        error: (xhr, status, err) => {
            var e = handleError('regenOutgoingHookToken', xhr, status, err);
            error(e);
        }
    });
}

export function uploadLicenseFile(formData, success, error) {
    $.ajax({
        url: '/api/v1/license/add',
        type: 'POST',
        data: formData,
        cache: false,
        contentType: false,
        processData: false,
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('uploadLicenseFile', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_license_upload');
}

export function removeLicenseFile(success, error) {
    $.ajax({
        url: '/api/v1/license/remove',
        type: 'POST',
        cache: false,
        contentType: false,
        processData: false,
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('removeLicenseFile', xhr, status, err);
            error(e);
        }
    });

    track('api', 'api_license_upload');
}

export function getClientLicenceConfig(success, error) {
    return $.ajax({
        url: '/api/v1/license/client_config',
        dataType: 'json',
        contentType: 'application/json',
        type: 'GET',
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getClientLicenceConfig', xhr, status, err);
            error(e);
        }
    });
}

export function getInviteInfo(success, error, id) {
    $.ajax({
        url: '/api/v1/teams/get_invite_info',
        type: 'POST',
        dataType: 'json',
        contentType: 'application/json',
        data: JSON.stringify({invite_id: id}),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('getInviteInfo', xhr, status, err);
            if (error) {
                error(e);
            }
        }
    });
}

export function verifyEmail(success, error, uid, hid) {
    $.ajax({
        url: '/api/v1/users/verify_email',
        type: 'POST',
        contentType: 'application/json',
        dataType: 'text',
        data: JSON.stringify({uid, hid}),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('verifyEmail', xhr, status, err);
            if (error) {
                error(e);
            }
        }
    });
}

export function resendVerification(success, error, teamName, email) {
    $.ajax({
        url: '/api/v1/users/resend_verification',
        type: 'POST',
        contentType: 'application/json',
        dataType: 'text',
        data: JSON.stringify({team_name: teamName, email}),
        success,
        error: function onError(xhr, status, err) {
            var e = handleError('resendVerification', xhr, status, err);
            if (error) {
                error(e);
            }
        }
    });
}
