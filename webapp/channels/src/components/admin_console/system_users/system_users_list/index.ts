// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {getUserReports, setAdminConsoleUsersManagementTableProperties} from 'actions/views/admin';
import {getAdminConsoleUserManagementDetails} from 'selectors/views/admin';

import type {GlobalState} from 'types/store';

import SystemUsersList from './system_users_list';

function mapStateToProps(state: GlobalState) {
    const currentUser = getCurrentUser(state);
    const {sortColumn, sortIsDescending, pageSize} = getAdminConsoleUserManagementDetails(state);

    return {
        currentUser,
        sortColumn,
        sortIsDescending,
        pageSize,
    };
}

const mapDispatchToProps = ({
    getUserReports,
    setAdminConsoleUsersManagementTableProperties,
});

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(SystemUsersList);
