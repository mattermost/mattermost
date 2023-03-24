// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getMyCurrentChannelMembership} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {GlobalState} from 'types/store/index';

import ProfilePopoverCallButton from './profile_popover_call_button';

function mapStateToProps(state: GlobalState) {
    return {
        pluginCallComponents: state.plugins.components.CallButton,
        channelMember: getMyCurrentChannelMembership(state),
        sidebarOpen: state.views.rhs.isSidebarOpen,
        currentUserId: getCurrentUserId(state),
    };
}

export default connect(mapStateToProps)(ProfilePopoverCallButton);
