// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Team} from '@mattermost/types/teams';

import {getTeam, patchTeam, removeTeamIcon, setTeamIcon, regenerateTeamInviteId} from 'mattermost-redux/actions/teams';
import {Permissions} from 'mattermost-redux/constants';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';

import {getIsMobileView} from 'selectors/views/browser';

import type {GlobalState} from 'types/store/index';

import TeamGeneralTab from './team_general_tab';

export type OwnProps = {
    updateSection: (section: string) => void;
    team: Team & { last_team_icon_update?: number };
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
        isMobileView: getIsMobileView(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
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
