// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {setUnreadFilterEnabled} from 'actions/views/channel_sidebar';
import {isUnreadFilterEnabled} from 'selectors/views/channel_sidebar';

import ChannelFilter from './channel_filter';

import type {GenericAction} from 'mattermost-redux/types/actions';
import type {Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    const teams = getMyTeams(state);

    return {
        hasMultipleTeams: teams && teams.length > 1,
        unreadFilterEnabled: isUnreadFilterEnabled(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            setUnreadFilterEnabled,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ChannelFilter);
