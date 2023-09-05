// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {openMenu as openRhsMenu} from 'actions/views/rhs';
import {getIsRhsMenuOpen} from 'selectors/rhs';
import {getIsMobileView} from 'selectors/views/browser';

import {GlobalState} from 'types/store';

import {GenericAction} from 'mattermost-redux/types/actions';

import SidebarRightMenu from './sidebar_right_menu';

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

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            openRhsMenu,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SidebarRightMenu);
