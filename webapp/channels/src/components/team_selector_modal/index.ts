// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getTeams as loadTeams, searchTeams} from 'mattermost-redux/actions/teams';
import {getTeams} from 'mattermost-redux/selectors/entities/teams';

import {setModalSearchTerm} from 'actions/views/search';

import TeamSelectorModal from './team_selector_modal';

import type {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, AnyAction, Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

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

type Actions = {
    loadTeams: (page?: number, perPage?: number, includeTotalCount?: boolean) => Promise<ActionResult>;
    searchTeams: (searchTerm: string) => void;
    setModalSearchTerm: (searchTerm: string) => GenericAction;
}

function mapDispatchToProps(dispatch: Dispatch<AnyAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Actions>({
            loadTeams,
            setModalSearchTerm,
            searchTeams,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(TeamSelectorModal);
