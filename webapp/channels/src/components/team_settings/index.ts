// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import TeamSettings from './team_settings';

function mapStateToProps(state: GlobalState) {
    return {
        team: getCurrentTeam(state),
    };
}

export default connect(mapStateToProps)(TeamSettings);
