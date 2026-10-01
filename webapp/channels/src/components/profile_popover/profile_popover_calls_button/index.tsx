// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {GlobalState} from 'types/store/index';

import ProfilePopoverCallButton from './profile_popover_call_button';

function mapStateToProps(state: GlobalState) {
    return {
        pluginCallComponents: state.plugins.components.CallButton,
        sidebarOpen: state.views.rhs.isSidebarOpen,
    };
}

export default connect(mapStateToProps)(ProfilePopoverCallButton);
