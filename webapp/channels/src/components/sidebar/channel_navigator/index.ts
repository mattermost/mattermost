// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import Permissions from 'mattermost-redux/constants/permissions';
import {shouldShowUnreadsCategory, isCustomGroupsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';

import {openModal, closeModal} from 'actions/views/modals';
import {isModalOpen} from 'selectors/views/modals';

import {getHistory} from 'utils/browser_history';
import {ModalIdentifiers} from 'utils/constants';

import ChannelNavigator from './channel_navigator';

import type {Action} from 'mattermost-redux/types/actions';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';
import type {ModalData} from 'types/actions';
import type {GlobalState} from 'types/store';

// TODO: For Phase 1. Will revisit history in Phase 2
function goBack() {
    return () => {
        getHistory().goBack();
        return {data: null};
    };
}

function goForward() {
    return () => {
        getHistory().goForward();
        return {data: null};
    };
}

function mapStateToProps(state: GlobalState) {
    const canCreateCustomGroups = haveISystemPermission(state, {permission: Permissions.CREATE_CUSTOM_GROUP}) && isCustomGroupsEnabled(state);
    return {
        canGoBack: true, // TODO: Phase 1 only
        canGoForward: true,
        showUnreadsCategory: shouldShowUnreadsCategory(state),
        isQuickSwitcherOpen: isModalOpen(state, ModalIdentifiers.QUICK_SWITCH),
        canCreateCustomGroups,
    };
}

type Actions = {
    openModal: <P>(modalData: ModalData<P>) => void;
    closeModal: (modalId: string) => void;
    goBack: () => void;
    goForward: () => void;
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>({
            openModal,
            closeModal,
            goBack,
            goForward,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ChannelNavigator);
