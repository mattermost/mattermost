// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {archiveGroup} from 'mattermost-redux/actions/groups';
import {getGroupListPermissions} from 'mattermost-redux/selectors/entities/roles';

import {openModal} from 'actions/views/modals';

import UserGroupsList from './user_groups_list';

import type {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';
import type {ModalData} from 'types/actions';
import type {GlobalState} from 'types/store';

type Actions = {
    openModal: <P>(modalData: ModalData<P>) => void;
    archiveGroup: (groupId: string) => Promise<ActionResult>;
};

function mapStateToProps(state: GlobalState) {
    const groupPermissionsMap = getGroupListPermissions(state);
    return {
        groupPermissionsMap,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Actions>({
            openModal,
            archiveGroup,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps, null, {forwardRef: true})(UserGroupsList);
