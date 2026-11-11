// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {PluginRedux} from '@mattermost/types/plugins';

import {getLogs, getNewLogs, getPlainLogs} from 'mattermost-redux/actions/admin';
import * as Selectors from 'mattermost-redux/selectors/entities/admin';

import type {GlobalState} from 'types/store';

import Logs from './logs';

// The store types the plugins as optional, and a shared empty value keeps the props stable
const NO_INSTALLED_PLUGINS: Record<string, PluginRedux> = {};

function mapStateToProps(state: GlobalState) {
    const config = Selectors.getConfig(state);

    return {
        logs: Selectors.getAllLogsWithNode(state),
        logNodes: Selectors.getLogNodes(state),
        truncatedLogNodes: Selectors.getTruncatedLogNodes(state),
        plainLogs: Selectors.getPlainLogs(state),
        isPlainLogs: config.LogSettings?.FileJson === false,
        plugins: state.entities.admin.plugins ?? NO_INSTALLED_PLUGINS,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getLogs,
            getNewLogs,
            getPlainLogs,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(Logs);
