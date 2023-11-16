// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {regenOutgoingOAuthConnectionSecret, deleteOutgoingOAuthConnection} from 'mattermost-redux/actions/integrations';
import {Permissions} from 'mattermost-redux/constants';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getOutgoingOAuthConnections} from 'mattermost-redux/selectors/entities/integrations';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import type {GenericAction} from 'mattermost-redux/types/actions';

import {loadOutgoingOAuthConnectionsAndProfiles} from 'actions/integration_actions';

import InstalledOutgoingOAuthConnections from './installed_outgoing_oauth_connections';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const enableOAuthServiceProvider = config.EnableOAuthServiceProvider === 'true';

    return {
        canManageOauth: haveISystemPermission(state, {permission: Permissions.MANAGE_OAUTH}),
        outgoingOAuthConnections: getOutgoingOAuthConnections(state),
        enableOAuthServiceProvider,
        team: getCurrentTeam(state),
    };
}

type Actions = {
    loadOutgoingOAuthConnectionsAndProfiles: (page?: number, perPage?: number) => Promise<void>;
    regenOutgoingOAuthConnectionSecret: (connectionId: string) => Promise<{ error?: Error }>;
    deleteOutgoingOAuthConnection: (connectionId: string) => Promise<void>;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject, Actions>({
            loadOutgoingOAuthConnectionsAndProfiles,
            regenOutgoingOAuthConnectionSecret,
            deleteOutgoingOAuthConnection,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(InstalledOutgoingOAuthConnections);
