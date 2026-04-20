// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getPluggableId} from 'selectors/rhs';

import type {GlobalState} from 'types/store';

import RHSPlugin from './rhs_plugin';

function mapStateToProps(state: GlobalState) {
    const rhsPlugins = state.plugins.components.RightHandSidebarComponent;
    const pluggableId = getPluggableId(state);
    const pluginComponent = rhsPlugins.find((element) => element.id === pluggableId);
    const pluginTitle = pluginComponent ? pluginComponent.title : '';
    const pluginId = pluginComponent ? pluginComponent.pluginId : undefined;

    return {
        showPluggable: Boolean(pluginComponent),
        pluggableId,
        title: pluginTitle,
        pluginId,
    };
}

export default connect(mapStateToProps)(RHSPlugin);
