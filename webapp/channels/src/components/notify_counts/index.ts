// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getUnreadStatusInCurrentTeam, basicUnreadMeta} from 'mattermost-redux/selectors/entities/channels';

import type {GlobalState} from 'types/store';

import NotifyCounts from './notify_counts';

function mapStateToProps(state: GlobalState) {
    return basicUnreadMeta(getUnreadStatusInCurrentTeam(state));
}

export default connect(mapStateToProps)(NotifyCounts);
