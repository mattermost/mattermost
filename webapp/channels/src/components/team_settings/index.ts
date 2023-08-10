// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import TeamSettings from './team_settings';

import type {GlobalState} from '@mattermost/types/store';

function mapStateToProps(state: GlobalState) {
    return {
        team: getCurrentTeam(state),
    };
}

export default connect(mapStateToProps)(TeamSettings);
