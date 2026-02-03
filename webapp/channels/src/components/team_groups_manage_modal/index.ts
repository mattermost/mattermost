// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {getGroupsAssociatedToTeam, unlinkGroupSyncable, patchGroupSyncable} from 'mattermost-redux/actions/groups';
import {getMyTeamMembers} from 'mattermost-redux/actions/teams';

import {closeModal, openModal} from 'actions/views/modals';

import TeamGroupsManageModal from './team_groups_manage_modal';

type OwnProps = {
    teamID: string;
};

const mapStateToProps = (state: GlobalState, ownProps: OwnProps) => {
    return {
        team: state.entities.teams.teams[ownProps.teamID],
    };
};

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        getGroupsAssociatedToTeam,
        closeModal,
        openModal,
        unlinkGroupSyncable,
        patchGroupSyncable,
        getMyTeamMembers,
    }, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(TeamGroupsManageModal);
