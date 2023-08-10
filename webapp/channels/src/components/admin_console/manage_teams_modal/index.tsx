// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {updateTeamMemberSchemeRoles, getTeamMembersForUser, getTeamsForUser, removeUserFromTeam} from 'mattermost-redux/actions/teams';

import {getCurrentLocale} from 'selectors/i18n';

import ManageTeamsModal from './manage_teams_modal';

import type {Props} from './manage_teams_modal';
import type {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    return {
        locale: getCurrentLocale(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Props['actions']>({
            getTeamMembersForUser,
            getTeamsForUser,
            updateTeamMemberSchemeRoles,
            removeUserFromTeam,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ManageTeamsModal);
