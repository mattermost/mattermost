// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';

import type {UserProfile} from '@mattermost/types/users';

import {getFilteredUsersStats, getProfiles, searchProfiles} from 'mattermost-redux/actions/users';
import {getRoles} from 'mattermost-redux/selectors/entities/roles_helpers';
import {getProfiles as selectProfiles, getFilteredUsersStats as selectFilteredUserStats, makeSearchProfilesStartingWithTerm, filterProfiles} from 'mattermost-redux/selectors/entities/users';
import type {GenericAction, ActionFunc} from 'mattermost-redux/types/actions';
import {filterProfilesStartingWithTerm, profileListToMap} from 'mattermost-redux/utils/user_utils';

import {setUserGridSearch} from 'actions/views/search';

import type {GlobalState} from 'types/store';

import SystemRoleUsers from './system_role_users';
import type {Props} from './system_role_users';

type OwnProps = {
    roleName: string;
    usersToAdd: Record<string, UserProfile>;
    usersToRemove: Record<string, UserProfile>;
}

function searchUsersToAdd(users: Record<string, UserProfile>, term: string): Record<string, UserProfile> {
    const profiles = filterProfilesStartingWithTerm(Object.keys(users).map((key) => users[key]), term);
    return filterProfiles(profileListToMap(profiles), {});
}

function mapStateToProps(state: GlobalState, props: OwnProps) {
    const {roleName} = props;
    const role = getRoles(state)[roleName];
    const totalCount = selectFilteredUserStats(state)?.total_users_count || 0;
    const term = state.views.search.userGridSearch?.term || '';
    const filters = {roles: [role.name]};
    const searchProfilesStartingWithTerm = makeSearchProfilesStartingWithTerm();

    let users = [];
    let {usersToAdd} = props;
    if (term) {
        users = searchProfilesStartingWithTerm(state, term, false, filters);
        usersToAdd = searchUsersToAdd(usersToAdd, term);
    } else {
        users = selectProfiles(state, filters);
    }

    return {
        role,
        users,
        totalCount,
        term,
        usersToAdd,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Props['actions']>({
            getProfiles,
            getFilteredUsersStats,
            searchProfiles,
            setUserGridSearch,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SystemRoleUsers);

