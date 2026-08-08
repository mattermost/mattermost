// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {appBarEnabled} from 'mattermost-redux/selectors/entities/apps';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {getChannelHeaderPluginComponents, shouldShowAppBar} from 'selectors/plugins';

import type {GlobalState} from 'types/store';

import ChannelHeaderPlug from './channel_header_plug';

function mapStateToProps(state: GlobalState) {
    return {
        components: getChannelHeaderPluginComponents(state),
        appBarEnabled: appBarEnabled(state),
        theme: getTheme(state),
        sidebarOpen: state.views.rhs.isSidebarOpen,
        shouldShowAppBar: shouldShowAppBar(state),
    };
}

export default connect(mapStateToProps)(ChannelHeaderPlug);
