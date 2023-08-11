// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {removeIncomingHook} from 'mattermost-redux/actions/integrations';
import {Permissions} from 'mattermost-redux/constants';
import {getAllChannels} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getIncomingHooks} from 'mattermost-redux/selectors/entities/integrations';
import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getUsers} from 'mattermost-redux/selectors/entities/users';
import type {ActionResult, GenericAction} from 'mattermost-redux/types/actions';

import {loadIncomingHooksAndProfilesForTeam} from 'actions/integration_actions.jsx';

import InstalledIncomingWebhooks from './installed_incoming_webhooks';

type Actions = {
    removeIncomingHook: (hookId: string) => Promise<ActionResult>;
    loadIncomingHooksAndProfilesForTeam: (teamId: string, startPageNumber: number, pageSize: string) => Promise<ActionResult>;
}

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const teamId = getCurrentTeamId(state);
    const canManageOthersWebhooks = haveITeamPermission(state, teamId, Permissions.MANAGE_OTHERS_INCOMING_WEBHOOKS);
    const incomingHooks = getIncomingHooks(state);
    const incomingWebhooks = Object.keys(incomingHooks).
        map((key) => incomingHooks[key]).
        filter((incomingWebhook) => incomingWebhook.team_id === teamId);
    const enableIncomingWebhooks = config.EnableIncomingWebhooks === 'true';

    return {
        incomingWebhooks,
        channels: getAllChannels(state),
        users: getUsers(state),
        canManageOthersWebhooks,
        enableIncomingWebhooks,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<any>, Actions>({
            loadIncomingHooksAndProfilesForTeam,
            removeIncomingHook,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(InstalledIncomingWebhooks);
