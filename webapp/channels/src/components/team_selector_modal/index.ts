// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getTeams as loadTeams, searchTeams} from 'mattermost-redux/actions/teams';
import {getTeams} from 'mattermost-redux/selectors/entities/teams';

import {setModalSearchTerm} from 'actions/views/search';

import type {GlobalState} from 'types/store';

import TeamSelectorModal from './team_selector_modal';

function mapStateToProps(state: GlobalState) {
    const searchTerm = state.views.search.modalSearch;

    const teams = Object.values(getTeams(state) || {}).filter((team) => {
        return team.display_name.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
               team.description.toLowerCase().startsWith(searchTerm.toLowerCase());
    });

    return {
        searchTerm,
        teams,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            loadTeams,
            setModalSearchTerm,
            searchTeams,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(TeamSelectorModal);
