// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {Team} from '@mattermost/types/teams';

import {getTeam, patchTeam, regenerateTeamInviteId} from 'mattermost-redux/actions/teams';
import {Permissions} from 'mattermost-redux/constants';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import type {ActionResult, GenericAction} from 'mattermost-redux/types/actions';

import {getIsMobileView} from 'selectors/views/browser';

import type {GlobalState} from 'types/store/index';

import TeamAccessTab from './team_access_tab';

export type OwnProps = {
    team?: Team & { last_team_icon_update?: number };
    hasChanges: boolean;
    hasChangeTabError: boolean;
    setHasChanges: (hasChanges: boolean) => void;
    setHasChangeTabError: (hasChangesError: boolean) => void;
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const config = getConfig(state);
    const maxFileSize = parseInt(config.MaxFileSize ?? '', 10);

    const canInviteTeamMembers = haveITeamPermission(state, ownProps.team?.id || '', Permissions.INVITE_USER);

    return {
        maxFileSize,
        canInviteTeamMembers,
        isMobileView: getIsMobileView(state),
    };
}

type Actions = {
    getTeam: (teamId: string) => Promise<ActionResult>;
    patchTeam: (team: Partial<Team>) => Promise<ActionResult>;
    regenerateTeamInviteId: (teamId: string) => Promise<ActionResult>;
};

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject, Actions>({
            getTeam,
            patchTeam,
            regenerateTeamInviteId,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(TeamAccessTab);
