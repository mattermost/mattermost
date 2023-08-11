// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import {AppBindingLocations} from 'mattermost-redux/constants/apps';
import {appsEnabled, makeAppBindingsSelector} from 'mattermost-redux/selectors/entities/apps';
import {getMyCurrentChannelMembership} from 'mattermost-redux/selectors/entities/channels';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import type {GenericAction} from 'mattermost-redux/types/actions';

import {handleBindingClick, openAppsModal, postEphemeralCallResponseForChannel} from 'actions/apps';

import type {HandleBindingClick, OpenAppsModal, PostEphemeralCallResponseForChannel} from 'types/apps';
import type {GlobalState} from 'types/store';

import MobileChannelHeaderPlug from './mobile_channel_header_plug';

const getChannelHeaderBindings = makeAppBindingsSelector(AppBindingLocations.CHANNEL_HEADER_ICON);

function mapStateToProps(state: GlobalState) {
    const apps = appsEnabled(state);
    return {
        appBindings: getChannelHeaderBindings(state),
        appsEnabled: apps,
        channelMember: getMyCurrentChannelMembership(state),
        components: state.plugins.components.MobileChannelHeaderButton,
        theme: getTheme(state),
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

export default connect(mapStateToProps, mapDispatchToProps)(MobileChannelHeaderPlug);
