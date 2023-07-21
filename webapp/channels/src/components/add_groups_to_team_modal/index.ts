// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Group} from '@mattermost/types/groups';
import {Team} from '@mattermost/types/teams';
import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {setModalSearchTerm} from 'actions/views/search';
import {getGroupsNotAssociatedToTeam, linkGroupSyncable, getAllGroupsAssociatedToTeam} from 'mattermost-redux/actions/groups';
import {getGroupsNotAssociatedToTeam as selectGroupsNotAssociatedToTeam} from 'mattermost-redux/selectors/entities/groups';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';

import {GlobalState} from '../../types/store';

import AddGroupsToTeamModal, {Actions} from './add_groups_to_team_modal';

type Props = {
    team?: Team;
    skipCommit?: boolean;
    onAddCallback?: (groupIDs: string[]) => void;
    excludeGroups?: Group[];
}

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const searchTerm = state.views.search.modalSearch;

    const team = ownProps.team || getCurrentTeam(state) || {};

    let groups = selectGroupsNotAssociatedToTeam(state, team.id);
    if (searchTerm) {
        const regex = RegExp(searchTerm, 'i');
        groups = groups.filter((group) => regex.test(group.display_name) || regex.test(group.name));
    }

    return {
        currentTeamName: team.display_name,
        currentTeamId: team.id,
        skipCommit: ownProps.skipCommit,
        onAddCallback: ownProps.onAddCallback,
        excludeGroups: ownProps.excludeGroups,
        searchTerm,
        groups,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc|GenericAction>, Actions>({
            getGroupsNotAssociatedToTeam,
            setModalSearchTerm,
            linkGroupSyncable,
            getAllGroupsAssociatedToTeam,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AddGroupsToTeamModal);
