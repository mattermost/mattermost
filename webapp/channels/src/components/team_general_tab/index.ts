// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Team} from '@mattermost/types/teams';
import {connect, ConnectedProps} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {getTeam, patchTeam, removeTeamIcon, setTeamIcon, regenerateTeamInviteId} from 'mattermost-redux/actions/teams';
import {Permissions} from 'mattermost-redux/constants';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {ActionResult, GenericAction} from 'mattermost-redux/types/actions';

import {GlobalState} from 'types/store/index';

import TeamGeneralTab from './team_general_tab';

export type OwnProps = {
    updateSection: (section: string) => void;
    team?: Team & { last_team_icon_update?: number };
    activeSection: string;
    closeModal: () => void;
    collapseModal: () => void;
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const config = getConfig(state);
    const maxFileSize = parseInt(config.MaxFileSize ?? '', 10);

    const canInviteTeamMembers = haveITeamPermission(state, ownProps.team?.id || '', Permissions.INVITE_USER);

    return {
        maxFileSize,
        canInviteTeamMembers,
    };
}

type Actions = {
    getTeam: (teamId: string) => Promise<ActionResult>;
    patchTeam: (team: Partial<Team>) => Promise<ActionResult>;
    regenerateTeamInviteId: (teamId: string) => Promise<ActionResult>;
    removeTeamIcon: (teamId: string) => Promise<ActionResult>;
    setTeamIcon: (teamId: string, teamIconFile: File) => Promise<ActionResult>;
};

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject, Actions>({
            getTeam,
            patchTeam,
            regenerateTeamInviteId,
            removeTeamIcon,
            setTeamIcon,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(TeamGeneralTab);
