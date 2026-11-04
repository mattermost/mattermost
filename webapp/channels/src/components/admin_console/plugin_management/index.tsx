// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {
    getPlugins,
    getPluginStatuses,
    removePlugin,
    uploadPlugin,
    installPluginFromUrl,
    enablePlugin,
    disablePlugin,
} from 'mattermost-redux/actions/admin';
import {Permissions} from 'mattermost-redux/constants';
import {getConfig} from 'mattermost-redux/selectors/entities/admin';
import {appsFeatureFlagEnabled} from 'mattermost-redux/selectors/entities/apps';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';

import usePluginStatusesSync from 'components/common/hooks/usePluginStatusesSync';

import PluginManagement from './plugin_management';

function mapStateToProps(state: any) {
    return {
        plugins: state.entities.admin.plugins,
        pluginStatuses: state.entities.admin.pluginStatuses,
        appsFeatureFlagEnabled: appsFeatureFlagEnabled(state),

        // The same rules that hide the Server Logs page
        canViewServerLogs: haveISystemPermission(state, {permission: Permissions.SYSCONSOLE_READ_REPORTING_SERVER_LOGS}) &&
            !getConfig(state).ExperimentalSettings?.RestrictSystemAdmin,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            uploadPlugin,
            installPluginFromUrl,
            removePlugin,
            getPlugins,
            getPluginStatuses,
            enablePlugin,
            disablePlugin,
        }, dispatch),
    };
}

const ConnectedPluginManagement = connect(mapStateToProps, mapDispatchToProps)(PluginManagement);

// Wrap the legacy class-based settings component so it can subscribe to plugin status changes
// and refetch on demand while the page is mounted.
export default function PluginManagementWithStatusesSync(props: React.ComponentProps<typeof ConnectedPluginManagement>) {
    usePluginStatusesSync();
    return <ConnectedPluginManagement {...props}/>;
}
