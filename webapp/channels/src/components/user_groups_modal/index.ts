// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';

import type {GetGroupsForUserParams, GetGroupsParams, Group, GroupSearchParams} from '@mattermost/types/groups';

import {getGroups, getGroupsByUserIdPaginated, searchGroups} from 'mattermost-redux/actions/groups';
import {makeGetAllAssociatedGroupsForReference, makeGetMyAllowReferencedGroups, searchAllowReferencedGroups, searchMyAllowReferencedGroups, searchArchivedGroups, getArchivedGroups} from 'mattermost-redux/selectors/entities/groups';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';

import {setModalSearchTerm} from 'actions/views/search';
import {isModalOpen} from 'selectors/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import UserGroupsModal from './user_groups_modal';

type Actions = {
    getGroups: (
        groupsParams: GetGroupsParams,
    ) => Promise<{data: Group[]}>;
    setModalSearchTerm: (term: string) => void;
    getGroupsByUserIdPaginated: (
        opts: GetGroupsForUserParams,
    ) => Promise<{data: Group[]}>;
    searchGroups: (
        params: GroupSearchParams,
    ) => Promise<{data: Group[]}>;
};

function makeMapStateToProps() {
    const getAllAssociatedGroupsForReference = makeGetAllAssociatedGroupsForReference();
    const getMyAllowReferencedGroups = makeGetMyAllowReferencedGroups();

    return function mapStateToProps(state: GlobalState) {
        const searchTerm = state.views.search.modalSearch;

        let groups: Group[] = [];
        let myGroups: Group[] = [];
        let archivedGroups: Group[] = [];
        if (searchTerm) {
            groups = searchAllowReferencedGroups(state, searchTerm, true);
            myGroups = searchMyAllowReferencedGroups(state, searchTerm, true);
            archivedGroups = searchArchivedGroups(state, searchTerm);
        } else {
            groups = getAllAssociatedGroupsForReference(state, true);
            myGroups = getMyAllowReferencedGroups(state, true);
            archivedGroups = getArchivedGroups(state);
        }

        return {
            showModal: isModalOpen(state, ModalIdentifiers.USER_GROUPS),
            groups,
            searchTerm,
            myGroups,
            archivedGroups,
            currentUserId: getCurrentUserId(state),
        };
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

export default connect(makeMapStateToProps, mapDispatchToProps, null, {forwardRef: true})(UserGroupsModal);
