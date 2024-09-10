// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {getIsRhsMenuOpen} from 'selectors/rhs';
import {getIsMobileView} from 'selectors/views/browser';

import type {GlobalState} from 'types/store';

import SidebarMobileRightMenu from './sidebar_mobile_right_menu';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const currentTeam = getCurrentTeam(state);

    const siteName = config.SiteName;

    return {
        teamDisplayName: currentTeam && currentTeam.display_name,
        isMobileView: getIsMobileView(state),
        isOpen: getIsRhsMenuOpen(state),
        siteName,
    };
}

export default connect(mapStateToProps)(SidebarMobileRightMenu);
