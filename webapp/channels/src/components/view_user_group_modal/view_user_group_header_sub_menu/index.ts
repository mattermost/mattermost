// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {addUsersToGroup, archiveGroup, removeUsersFromGroup} from 'mattermost-redux/actions/groups';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';

import ViewUserGroupHeaderSubMenu from './view_user_group_header_sub_menu';

import type {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';
import type {ModalData} from 'types/actions';
import type {GlobalState} from 'types/store';

type Actions = {
    openModal: <P>(modalData: ModalData<P>) => void;
    removeUsersFromGroup: (groupId: string, userIds: string[]) => Promise<ActionResult>;
    addUsersToGroup: (groupId: string, userIds: string[]) => Promise<ActionResult>;
    archiveGroup: (groupId: string) => Promise<ActionResult>;
};

function mapStateToProps(state: GlobalState) {
    return {
        currentUserId: getCurrentUserId(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Actions>({
            openModal,
            removeUsersFromGroup,
            addUsersToGroup,
            archiveGroup,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewUserGroupHeaderSubMenu);
