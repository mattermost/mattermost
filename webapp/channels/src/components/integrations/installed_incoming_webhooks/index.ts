// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';
import type {GlobalState} from '@mattermost/types/store';

import {removeIncomingHook} from 'mattermost-redux/actions/integrations';
import {Permissions} from 'mattermost-redux/constants';
import {getAllChannels} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getUsers} from 'mattermost-redux/selectors/entities/users';

import {loadIncomingHooksAndProfilesForTeam} from 'actions/integration_actions';

import InstalledIncomingWebhooks from './installed_incoming_webhooks';
import {getIncomingHooks, getIncomingHooksTotalCount} from 'mattermost-redux/selectors/entities/integrations';

function mapStateToProps(state: GlobalState) {
    const teamId = getCurrentTeamId(state);
    const incomingHooksFromState = getIncomingHooks(state);
    const incomingHooks = Object.keys(incomingHooksFromState)
        .map((key) => incomingHooksFromState[key])
        .filter((incomingHook) => incomingHook.team_id === teamId);
    const incomingHooksTotalCount = getIncomingHooksTotalCount(state);
    const config = getConfig(state);
    const canManageOthersWebhooks = haveITeamPermission(state, teamId, Permissions.MANAGE_OTHERS_INCOMING_WEBHOOKS);
    const enableIncomingWebhooks = config.EnableIncomingWebhooks === 'true';

    return {
        incomingHooks,
        incomingHooksTotalCount,
        channels: getAllChannels(state),
        users: getUsers(state),
        canManageOthersWebhooks,
        enableIncomingWebhooks,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            loadIncomingHooksAndProfilesForTeam,
            removeIncomingHook,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(InstalledIncomingWebhooks);
