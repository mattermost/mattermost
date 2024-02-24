// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Team} from '@mattermost/types/teams';

import {getTeam, patchTeam, removeTeamIcon, setTeamIcon} from 'mattermost-redux/actions/teams';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store/index';

import TeamInfoTab from './team_info_tab';

export type OwnProps = {
    team: Team;
    hasChanges: boolean;
    hasChangeTabError: boolean;
    setHasChanges: (hasChanges: boolean) => void;
    setHasChangeTabError: (hasChangesError: boolean) => void;
    closeModal: () => void;
    collapseModal: () => void;
};

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const maxFileSize = parseInt(config.MaxFileSize ?? '', 10);

    return {
        maxFileSize,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getTeam,
            patchTeam,
            removeTeamIcon,
            setTeamIcon,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(TeamInfoTab);
