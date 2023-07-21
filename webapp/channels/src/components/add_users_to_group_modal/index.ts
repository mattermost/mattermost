// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {openModal} from 'actions/views/modals';
import {addUsersToGroup} from 'mattermost-redux/actions/groups';
import {getGroup} from 'mattermost-redux/selectors/entities/groups';
import {Action, ActionResult} from 'mattermost-redux/types/actions';

import {ModalData} from 'types/actions';
import {GlobalState} from 'types/store';

import AddUsersToGroupModal from './add_users_to_group_modal';

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
