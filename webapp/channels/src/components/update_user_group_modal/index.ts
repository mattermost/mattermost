// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {CustomGroupPatch} from '@mattermost/types/groups';

import {patchGroup} from 'mattermost-redux/actions/groups';
import {getGroup} from 'mattermost-redux/selectors/entities/groups';
import type {Action, ActionResult} from 'mattermost-redux/types/actions';

import {openModal} from 'actions/views/modals';

import type {ModalData} from 'types/actions';
import type {GlobalState} from 'types/store';

import UpdateUserGroupModal from './update_user_group_modal';

type OwnProps = {
    groupId: string;
}

function makeMapStateToProps(state: GlobalState, props: OwnProps) {
    const group = getGroup(state, props.groupId);

    return {
        group,
    };
}

type Actions = {
    patchGroup: (groupId: string, group: CustomGroupPatch) => Promise<ActionResult>;
    openModal: <P>(modalData: ModalData<P>) => void;
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>({
            patchGroup,
            openModal,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(UpdateUserGroupModal);
