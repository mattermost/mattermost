// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {fetchMyCategories} from 'mattermost-redux/actions/channel_categories';
import {getThreadsForCurrentTeam} from 'mattermost-redux/actions/threads';
import Permissions from 'mattermost-redux/constants/permissions';
import {isCustomGroupsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {haveICurrentChannelPermission, haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {clearChannelSelection} from 'actions/views/channel_sidebar';
import {fetchChannelSyncState} from 'actions/views/channel_sync';
import {closeModal, openModal} from 'actions/views/modals';
import {closeRightHandSide} from 'actions/views/rhs';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {getIsLhsOpen} from 'selectors/lhs';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';
import {getIsMobileView} from 'selectors/views/browser';
import {isUnreadFilterEnabled} from 'selectors/views/channel_sidebar';
import {isThreadsInSidebarActive, isDmMode, isGuildedLayoutEnabled} from 'selectors/views/guilded_layout';
import {isModalOpen} from 'selectors/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import Sidebar from './sidebar';

function mapStateToProps(state: GlobalState) {
    const currentTeam = getCurrentTeam(state);
    const unreadFilterEnabled = isUnreadFilterEnabled(state);

    let canCreatePublicChannel = false;
    let canCreatePrivateChannel = false;
    let canJoinPublicChannel = false;

    if (currentTeam) {
        canCreatePublicChannel = haveICurrentChannelPermission(state, Permissions.CREATE_PUBLIC_CHANNEL);
        canCreatePrivateChannel = haveICurrentChannelPermission(state, Permissions.CREATE_PRIVATE_CHANNEL);
        canJoinPublicChannel = haveICurrentChannelPermission(state, Permissions.JOIN_PUBLIC_CHANNELS);
    }

    const canCreateCustomGroups = isCustomGroupsEnabled(state) && haveISystemPermission(state, {permission: Permissions.CREATE_CUSTOM_GROUP});

    // Check if ThreadsInSidebar behavior is active (either ThreadsInSidebar OR GuildedChatLayout flag)
    const isThreadsInSidebarEnabled = isThreadsInSidebarActive(state);

    const config = getConfig(state);

    return {
        teamId: currentTeam ? currentTeam.id : '',
        isChannelSyncEnabled: config.FeatureFlagChannelSync === 'true',
        canCreatePrivateChannel,
        canCreatePublicChannel,
        canJoinPublicChannel,
        isOpen: getIsLhsOpen(state),
        unreadFilterEnabled,
        isMobileView: getIsMobileView(state),
        isKeyBoardShortcutModalOpen: isModalOpen(state, ModalIdentifiers.KEYBOARD_SHORTCUTS_MODAL),
        canCreateCustomGroups,
        rhsState: getRhsState(state),
        rhsOpen: getIsRhsOpen(state),
        isThreadsInSidebarEnabled,
        isDmMode: isDmMode(state),
        isGuildedLayoutEnabled: isGuildedLayoutEnabled(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            clearChannelSelection,
            fetchMyCategories,
            fetchChannelSyncState,
            getThreadsForCurrentTeam,
            openModal,
            closeModal,
            closeRightHandSide,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(Sidebar);
