// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getUnreadChannels} from 'selectors/views/channel_sidebar';

import UnreadChannels from './unread_channels';

import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    return {
        unreadChannels: getUnreadChannels(state),
    };
}

export default connect(mapStateToProps)(UnreadChannels);
