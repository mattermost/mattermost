// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import {appBarEnabled, appsEnabled, getChannelHeaderAppBindings} from 'mattermost-redux/selectors/entities/apps';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import type {GenericAction} from 'mattermost-redux/types/actions';

import {handleBindingClick, openAppsModal, postEphemeralCallResponseForChannel} from 'actions/apps';
import {getChannelHeaderPluginComponents, shouldShowAppBar} from 'selectors/plugins';

import type {HandleBindingClick, OpenAppsModal, PostEphemeralCallResponseForChannel} from 'types/apps';
import type {GlobalState} from 'types/store';

import ChannelHeaderPlug from './channel_header_plug';

function mapStateToProps(state: GlobalState) {
    const apps = appsEnabled(state);
    return {
        components: getChannelHeaderPluginComponents(state),
        appBindings: getChannelHeaderAppBindings(state),
        appsEnabled: apps,
        appBarEnabled: appBarEnabled(state),
        theme: getTheme(state),
        sidebarOpen: state.views.rhs.isSidebarOpen,
        shouldShowAppBar: shouldShowAppBar(state),
    };
}

type Actions = {
    handleBindingClick: HandleBindingClick;
    postEphemeralCallResponseForChannel: PostEphemeralCallResponseForChannel;
    openAppsModal: OpenAppsModal;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<any>, Actions>({
            handleBindingClick,
            postEphemeralCallResponseForChannel,
            openAppsModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ChannelHeaderPlug);
