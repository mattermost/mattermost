// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import {getProfilesInGroup as getUsersInGroup} from 'mattermost-redux/actions/users';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getProfilesInGroupWithoutSorting, searchProfilesInGroupWithoutSorting} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {openDirectChannelToUserId} from 'actions/channel_actions';
import {closeRightHandSide} from 'actions/views/rhs';

import type {GlobalState} from 'types/store';

import GroupMemberList from './group_member_list';
import type {GroupMember} from './group_member_list';

type OwnProps = {
    group: Group;
};

const sortProfileList = (
    profiles: UserProfile[],
    teammateNameDisplaySetting: string,
) => {
    const groupMembers: GroupMember[] = [];
    profiles.forEach((profile) => {
        groupMembers.push({
            user: profile,
            displayName: displayUsername(profile, teammateNameDisplaySetting),
        });
    });

    groupMembers.sort((a, b) => {
        return a.displayName.localeCompare(b.displayName);
    });

    return groupMembers;
};

const getProfilesSortedByDisplayName = createSelector(
    'getProfilesSortedByDisplayName',
    getProfilesInGroupWithoutSorting,
    getTeammateNameDisplaySetting,
    sortProfileList,
);

const searchProfilesSortedByDisplayName = createSelector(
    'searchProfilesSortedByDisplayName',
    searchProfilesInGroupWithoutSorting,
    getTeammateNameDisplaySetting,
    sortProfileList,
);

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const searchTerm = state.views.search.popoverSearch;

    let members: GroupMember[] = [];
    if (searchTerm) {
        members = searchProfilesSortedByDisplayName(state, ownProps.group.id, searchTerm);
    } else {
        members = getProfilesSortedByDisplayName(state, ownProps.group.id);
    }

    return {
        members,
        searchTerm,
        teamUrl: getCurrentRelativeTeamUrl(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getUsersInGroup,
            openDirectChannelToUserId,
            closeRightHandSide,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(GroupMemberList);
