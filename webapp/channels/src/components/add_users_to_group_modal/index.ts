// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {addUsersToGroup} from 'mattermost-redux/actions/groups';
import {getGroup} from 'mattermost-redux/selectors/entities/groups';

import {openModal} from 'actions/views/modals';

import AddUsersToGroupModal from './add_users_to_group_modal';

import type {Action, ActionResult} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';
import type {ModalData} from 'types/actions';
import type {GlobalState} from 'types/store';

type Actions = {
    addUsersToGroup: (groupId: string, userIds: string[]) => Promise<ActionResult>;
    openModal: <P>(modalData: ModalData<P>) => void;
}

type OwnProps = {
    groupId: string;
}

function mapStateToProps(state: GlobalState, props: OwnProps) {
    const group = getGroup(state, props.groupId);

    return {
        group,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>({
            addUsersToGroup,
            openModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AddUsersToGroupModal);
