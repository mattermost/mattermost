// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {getIsRhsMenuOpen} from 'selectors/rhs';

import type {GlobalState} from 'types/store';

import MobileRightDrawer from './mobile_right_drawer';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const currentTeam = getCurrentTeam(state);
    const siteName = config.SiteName;

    return {
        currentUser: getCurrentUser(state),
        teamDisplayName: currentTeam && currentTeam.display_name,
        isOpen: getIsRhsMenuOpen(state),
        siteName,
    };
}

const connector = connect(mapStateToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connect(mapStateToProps)(MobileRightDrawer);
