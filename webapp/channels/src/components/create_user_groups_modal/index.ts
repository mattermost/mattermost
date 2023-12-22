// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {GroupCreateWithUserIds} from '@mattermost/types/groups';

import {createGroupWithUserIds} from 'mattermost-redux/actions/groups';
import type {Action, ActionResult} from 'mattermost-redux/types/actions';

import {openModal} from 'actions/views/modals';

import type {ModalData} from 'types/actions';

import CreateUserGroupsModal from './create_user_groups_modal';

type Actions = {
    createGroupWithUserIds: (group: GroupCreateWithUserIds) => Promise<ActionResult>;
    openModal: <P>(modalData: ModalData<P>) => void;
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>({
            createGroupWithUserIds,
            openModal,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(CreateUserGroupsModal);
