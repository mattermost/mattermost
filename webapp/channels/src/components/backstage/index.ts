// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {withRouter} from 'react-router-dom';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {getMyTeams, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {haveITeamPermission, haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';
import {Permissions} from 'mattermost-redux/constants';

import {GlobalState} from 'types/store';

import BackstageController from './backstage_controller';

function mapStateToProps(state: GlobalState) {
    const user = getCurrentUser(state);
    const team = getCurrentTeam(state);

    const config = getConfig(state);

    const siteName = config.SiteName;
    const enableCustomEmoji = config.EnableCustomEmoji === 'true';
    const enableIncomingWebhooks = config.EnableIncomingWebhooks === 'true';
    const enableOutgoingWebhooks = config.EnableOutgoingWebhooks === 'true';
    const enableCommands = config.EnableCommands === 'true';
    const enableOAuthServiceProvider = config.EnableOAuthServiceProvider === 'true';

    let canCreateOrDeleteCustomEmoji = (haveISystemPermission(state, {permission: Permissions.CREATE_EMOJIS}) || haveISystemPermission(state, {permission: Permissions.DELETE_EMOJIS}));
    if (!canCreateOrDeleteCustomEmoji) {
        for (const t of getMyTeams(state)) {
            if (haveITeamPermission(state, t.id, Permissions.CREATE_EMOJIS) || haveITeamPermission(state, t.id, Permissions.DELETE_EMOJIS)) {
                canCreateOrDeleteCustomEmoji = true;
                break;
            }
        }
    }

    const canManageTeamIntegrations = (haveITeamPermission(state, '', Permissions.MANAGE_SLASH_COMMANDS) || haveITeamPermission(state, '', Permissions.MANAGE_OAUTH) || haveITeamPermission(state, '', Permissions.MANAGE_INCOMING_WEBHOOKS) || haveITeamPermission(state, '', Permissions.MANAGE_OUTGOING_WEBHOOKS));
    const canManageSystemBots = (haveISystemPermission(state, {permission: Permissions.MANAGE_BOTS}) || haveISystemPermission(state, {permission: Permissions.MANAGE_OTHERS_BOTS}));
    const canManageIntegrations = canManageTeamIntegrations || canManageSystemBots;

    return {
        user,
        team,
        siteName,
        enableCustomEmoji,
        enableIncomingWebhooks,
        enableOutgoingWebhooks,
        enableCommands,
        enableOAuthServiceProvider,
        canCreateOrDeleteCustomEmoji,
        canManageIntegrations,
    };
}

export default withRouter(connect(mapStateToProps)(BackstageController));
