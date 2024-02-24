// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Team} from '@mattermost/types/teams';

import {patchTeam, regenerateTeamInviteId} from 'mattermost-redux/actions/teams';

import TeamAccessTab from './team_access_tab';

export type OwnProps = {
    team: Team;
    hasChanges: boolean;
    hasChangeTabError: boolean;
    setHasChanges: (hasChanges: boolean) => void;
    setHasChangeTabError: (hasChangesError: boolean) => void;
    closeModal: () => void;
    collapseModal: () => void;
};

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            patchTeam,
            regenerateTeamInviteId,
        }, dispatch),
    };
}

const connector = connect(null, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(TeamAccessTab);
