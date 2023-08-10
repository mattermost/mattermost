// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import AdminSidebarHeader from './admin_sidebar_header';

import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    return {
        currentUser: getCurrentUser(state),
    };
}

export default connect(mapStateToProps)(AdminSidebarHeader);
