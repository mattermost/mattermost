// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {Permissions} from 'mattermost-redux/constants';
import {isMarketplaceEnabled} from 'mattermost-redux/selectors/entities/general';
import {haveICurrentTeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {isSystemAdmin} from 'mattermost-redux/utils/user_utils';

import {openModal} from 'actions/views/modals';
import {getIsMobileView} from 'selectors/views/browser';

import type {GlobalState} from 'types/store';

import ActionsMenu from './actions_menu';

function mapStateToProps(state: GlobalState) {
    const currentUser = getCurrentUser(state);
    const isSysAdmin = isSystemAdmin(currentUser.roles);

    return {
        pluginMenuItemComponents: state.plugins.components.PostDropdownMenuItem,
        isSysAdmin,
        pluginMenuItems: state.plugins.components.PostDropdownMenu,
        teamId: getCurrentTeamId(state),
        isMobileView: getIsMobileView(state),
        canOpenMarketplace: (
            isMarketplaceEnabled(state) &&
            haveICurrentTeamPermission(state, Permissions.SYSCONSOLE_WRITE_PLUGINS)
        ),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ActionsMenu);
