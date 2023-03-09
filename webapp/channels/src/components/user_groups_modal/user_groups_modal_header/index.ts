// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch, ActionCreatorsMapObject} from 'redux';

import {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';

import {GlobalState} from 'types/store';

import {ModalData} from 'types/actions';
import {Permissions} from 'mattermost-redux/constants';
import {openModal} from 'actions/views/modals';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';

import UserGroupsModalHeader from './user_groups_modal_header';

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
