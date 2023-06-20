// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {getCurrentLocale} from 'selectors/i18n';

import {updateTeamMemberSchemeRoles, getTeamMembersForUser, getTeamsForUser, removeUserFromTeam} from 'mattermost-redux/actions/teams';
import {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';
import {GlobalState} from 'types/store';

import ManageTeamsModal, {Props} from './manage_teams_modal';

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
