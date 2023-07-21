// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch, ActionCreatorsMapObject} from 'redux';

import {openModal} from 'actions/views/modals';
import {addUsersToGroup, archiveGroup, removeUsersFromGroup} from 'mattermost-redux/actions/groups';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';

import {ModalData} from 'types/actions';
import {GlobalState} from 'types/store';

import ViewUserGroupHeaderSubMenu from './view_user_group_header_sub_menu';

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
