// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getUserPreferences} from 'mattermost-redux/actions/preferences';
import {addUserToTeam} from 'mattermost-redux/actions/teams';
import {updateUserActive, getUser, patchUser, updateUserMfa} from 'mattermost-redux/actions/users';
import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';

import {setNavigationBlocked} from 'actions/admin_actions.jsx';
import {openModal} from 'actions/views/modals';
import {getConsoleAccess} from 'selectors/admin_console';

import {it} from 'components/admin_console/admin_definition';

import {isEnterpriseOrE20License} from 'utils/license_utils';

import SystemUserDetail from './system_user_detail';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const license = getLicense(state);
    const isEnterprise = isEnterpriseOrE20License(license);

    const clientConfig = getConfig(state);
    const consoleAccess = getConsoleAccess(state);
    const userHasWriteUserPermission = it.userHasWritePermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.USERS)({}, state, license, clientConfig.BuildEnterpriseReady === 'true', consoleAccess);

    return {
        mfaEnabled: config?.EnableMultifactorAuthentication === 'true' || false,
        isEnterprise,
        userHasWriteUserPermission,
    };
}

const mapDispatchToProps = {
    getUser,
    patchUser,
    updateUserActive,
    updateUserMfa,
    addUserToTeam,
    setNavigationBlocked,
    openModal,
    getUserPreferences,
};
const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;
export default connector(SystemUserDetail);
