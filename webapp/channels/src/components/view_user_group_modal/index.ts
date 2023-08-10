// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getGroup} from 'mattermost-redux/actions/groups';
import {getProfilesInGroup as getUsersInGroup, searchProfiles} from 'mattermost-redux/actions/users';
import {getGroup as getGroupById} from 'mattermost-redux/selectors/entities/groups';
import {getProfilesInGroup, searchProfilesInGroup} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';
import {setModalSearchTerm} from 'actions/views/search';

import ViewUserGroupModal from './view_user_group_modal';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';
import type {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';
import type {ModalData} from 'types/actions';
import type {GlobalState} from 'types/store';

type Actions = {
    getGroup: (groupId: string, includeMemberCount: boolean) => Promise<{data: Group}>;
    getUsersInGroup: (groupId: string, page: number, perPage: number) => Promise<{data: UserProfile[]}>;
    setModalSearchTerm: (term: string) => void;
    openModal: <P>(modalData: ModalData<P>) => void;
    searchProfiles: (term: string, options: any) => Promise<ActionResult>;
};

type OwnProps = {
    groupId: string;
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const searchTerm = state.views.search.modalSearch;

    const group = getGroupById(state, ownProps.groupId);

    let users: UserProfile[] = [];
    if (searchTerm) {
        users = searchProfilesInGroup(state, ownProps.groupId, searchTerm);
    } else {
        users = getProfilesInGroup(state, ownProps.groupId);
    }

    return {
        group,
        users,
        searchTerm,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Actions>({
            getGroup,
            getUsersInGroup,
            setModalSearchTerm,
            openModal,
            searchProfiles,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewUserGroupModal);
