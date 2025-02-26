// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {getSelectedChannel, getSelectedPost} from 'selectors/rhs';

import type {GlobalState} from 'types/store';

import RhsThread from './rhs_thread';

function mapStateToProps(state: GlobalState) {
    const selected = getSelectedPost(state);
    const channel = getSelectedChannel(state);
    const currentTeam = getCurrentTeam(state);

    return {
        selected,
        channel,
        currentTeam,
    };
}
export default connect(mapStateToProps)(RhsThread);
