// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch, ActionCreatorsMapObject} from 'redux';

import {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';
import {ServerError} from '@mattermost/types/errors';
import {UserProfile} from '@mattermost/types/users';
import {Group} from '@mattermost/types/groups';

import {GlobalState} from 'types/store';

import {getProfilesInGroupWithoutSorting, searchProfilesInGroupWithoutSorting} from 'mattermost-redux/selectors/entities/users';
import {getProfilesInGroup as getUsersInGroup} from 'mattermost-redux/actions/users';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {openDirectChannelToUserId} from 'actions/channel_actions';
import {closeRightHandSide} from 'actions/views/rhs';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import GroupMemberList, {GroupMember} from './group_member_list';

type Actions = {
    getUsersInGroup: (groupId: string, page: number, perPage: number) => Promise<{data: UserProfile[]}>;
    openDirectChannelToUserId: (userId?: string) => Promise<{error: ServerError}>;
    closeRightHandSide: () => void;
};

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
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Actions>({
            getUsersInGroup,
            openDirectChannelToUserId,
            closeRightHandSide,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(GroupMemberList);
