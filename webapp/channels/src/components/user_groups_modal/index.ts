// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Group, GroupSearachParams} from '@mattermost/types/groups';
import {connect} from 'react-redux';
import {bindActionCreators, Dispatch, ActionCreatorsMapObject} from 'redux';

import {setModalSearchTerm} from 'actions/views/search';
import {getGroups, getGroupsByUserIdPaginated, searchGroups} from 'mattermost-redux/actions/groups';
import {getAllAssociatedGroupsForReference, getMyAllowReferencedGroups, searchAllowReferencedGroups, searchMyAllowReferencedGroups} from 'mattermost-redux/selectors/entities/groups';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';
import {isModalOpen} from 'selectors/views/modals';

import {GlobalState} from 'types/store';
import {ModalIdentifiers} from 'utils/constants';

import UserGroupsModal from './user_groups_modal';

type Actions = {
    getGroups: (
        filterAllowReference?: boolean,
        page?: number,
        perPage?: number,
        includeMemberCount?: boolean
    ) => Promise<{data: Group[]}>;
    setModalSearchTerm: (term: string) => void;
    getGroupsByUserIdPaginated: (
        userId: string,
        filterAllowReference?: boolean,
        page?: number,
        perPage?: number,
        includeMemberCount?: boolean
    ) => Promise<{data: Group[]}>;
    searchGroups: (
        params: GroupSearachParams,
    ) => Promise<{data: Group[]}>;
};

function mapStateToProps(state: GlobalState) {
    const searchTerm = state.views.search.modalSearch;

    let groups: Group[] = [];
    let myGroups: Group[] = [];
    if (searchTerm) {
        groups = searchAllowReferencedGroups(state, searchTerm);
        myGroups = searchMyAllowReferencedGroups(state, searchTerm);
    } else {
        groups = getAllAssociatedGroupsForReference(state);
        myGroups = getMyAllowReferencedGroups(state);
    }

    return {
        showModal: isModalOpen(state, ModalIdentifiers.USER_GROUPS),
        groups,
        searchTerm,
        myGroups,
        currentUserId: getCurrentUserId(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Actions>({
            getGroups,
            setModalSearchTerm,
            getGroupsByUserIdPaginated,
            searchGroups,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(UserGroupsModal);
