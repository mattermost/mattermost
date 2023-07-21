// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch, ActionCreatorsMapObject} from 'redux';

import {openModal} from 'actions/views/modals';
import {archiveGroup} from 'mattermost-redux/actions/groups';
import {getGroupListPermissions} from 'mattermost-redux/selectors/entities/roles';
import {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';

import {ModalData} from 'types/actions';
import {GlobalState} from 'types/store';

import UserGroupsList from './user_groups_list';

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
