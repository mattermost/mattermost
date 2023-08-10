// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {Permissions} from 'mattermost-redux/constants';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';

import {openModal} from 'actions/views/modals';

import UserGroupsModalHeader from './user_groups_modal_header';

import type {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';
import type {ModalData} from 'types/actions';
import type {GlobalState} from 'types/store';

type Actions = {
    openModal: <P>(modalData: ModalData<P>) => void;
};

function mapStateToProps(state: GlobalState) {
    const canCreateCustomGroups = haveISystemPermission(state, {permission: Permissions.CREATE_CUSTOM_GROUP});

    return {
        canCreateCustomGroups,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Actions>({
            openModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(UserGroupsModalHeader);
