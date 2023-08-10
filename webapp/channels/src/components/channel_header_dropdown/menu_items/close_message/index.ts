// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getRedirectChannelNameForTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {leaveDirectChannel} from 'actions/views/channel';

import CloseMessage from './close_message';

import type {Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

const mapStateToProps = (state: GlobalState) => {
    return {
        currentTeam: getCurrentTeam(state),
        redirectChannel: getRedirectChannelNameForTeam(state, getCurrentTeamId(state)),
    };
};

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({savePreferences, leaveDirectChannel}, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(CloseMessage);
