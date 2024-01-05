// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getSiteName} from 'mattermost-redux/selectors/entities/general';

import {notificationPermissionRequested} from 'actions/notification_actions';

import type {GlobalState} from 'types/store';

import NotificationPermissionBar from './notification_permission_bar';

function mapStateToProps(state: GlobalState) {
    return {
        siteName: getSiteName(state),
    };
}

const mapDispatchToProps = {
    notificationPermissionRequested,
};

export default connect(mapStateToProps, mapDispatchToProps)(NotificationPermissionBar);
