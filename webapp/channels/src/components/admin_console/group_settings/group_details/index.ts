// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {
    getGroup as fetchGroup,
    getGroupStats,
    getGroupSyncables as fetchGroupSyncables,
    linkGroupSyncable,
    patchGroup,
    patchGroupSyncable,
    unlinkGroupSyncable,
} from 'mattermost-redux/actions/groups';
import {getProfilesInGroup} from 'mattermost-redux/actions/users';
import {
    getGroup,
    getGroupChannels,
    getGroupMemberCount,
    getGroupTeams,
} from 'mattermost-redux/selectors/entities/groups';
import {getProfilesInGroup as selectProfilesInGroup} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';

import {setNavigationBlocked} from 'actions/admin_actions';

import GroupDetails from './group_details';
import type {Props} from './group_details';

type OwnProps = {
    match: {
        params: {
            group_id: string;
        };
    };
};

function mapStateToProps(state: GlobalState, props: OwnProps) {
    const groupID = props.match.params.group_id;
    const group = getGroup(state, groupID);
    const groupTeams = getGroupTeams(state, groupID);
    const groupChannels = getGroupChannels(state, groupID);
    const members = selectProfilesInGroup(state, groupID);
    const memberCount = getGroupMemberCount(state, groupID);

    return {
        groupID,
        group,
        groupTeams,
        groupChannels,
        members,
        memberCount,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<
        ActionCreatorsMapObject<ActionFunc | GenericAction>,
        Props['actions']
        >(
            {
                setNavigationBlocked,
                getGroup: fetchGroup,
                getMembers: getProfilesInGroup,
                getGroupStats,
                getGroupSyncables: fetchGroupSyncables,
                link: linkGroupSyncable,
                unlink: unlinkGroupSyncable,
                patchGroupSyncable,
                patchGroup,
            },
            dispatch,
        ),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(GroupDetails);
