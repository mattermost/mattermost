// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getUsersLimits} from 'mattermost-redux/selectors/entities/limits';

import AdminConsoleUsersLimitsAnnouncementBar from './admin_console_users_limits_announcement_bar';

function mapStateToProps(state: GlobalState) {
    const usersLimits = getUsersLimits(state);

    return {
        usersLimits,
    };
}

const mapDispatchToProps = {
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(AdminConsoleUsersLimitsAnnouncementBar);
