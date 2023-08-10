// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {regenOAuthAppSecret, deleteOAuthApp} from 'mattermost-redux/actions/integrations';
import {Permissions} from 'mattermost-redux/constants';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getAppsOAuthAppIDs, getOAuthApps} from 'mattermost-redux/selectors/entities/integrations';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {loadOAuthAppsAndProfiles} from 'actions/integration_actions';

import InstalledOAuthApps from './installed_oauth_apps';

import type {GlobalState} from '@mattermost/types/store';
import type {GenericAction} from 'mattermost-redux/types/actions';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const enableOAuthServiceProvider = config.EnableOAuthServiceProvider === 'true';

    return {
        canManageOauth: haveISystemPermission(state, {permission: Permissions.MANAGE_OAUTH}),
        oauthApps: getOAuthApps(state),
        appsOAuthAppIDs: getAppsOAuthAppIDs(state),
        enableOAuthServiceProvider,
        team: getCurrentTeam(state),
    };
}

type Actions = {
    loadOAuthAppsAndProfiles: (page?: number, perPage?: number) => Promise<void>;
    regenOAuthAppSecret: (appId: string) => Promise<{ error?: Error }>;
    deleteOAuthApp: (appId: string) => Promise<void>;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject, Actions>({
            loadOAuthAppsAndProfiles,
            regenOAuthAppSecret,
            deleteOAuthApp,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(InstalledOAuthApps);
