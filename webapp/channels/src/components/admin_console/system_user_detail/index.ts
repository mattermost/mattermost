// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';
import {LicenseSkus} from 'utils/constants';

import type {GlobalState} from '@mattermost/types/store';

import {getUserPreferences} from 'mattermost-redux/actions/preferences';
import {addUserToTeam} from 'mattermost-redux/actions/teams';
import {updateUserActive, getUser, patchUser, updateUserMfa} from 'mattermost-redux/actions/users';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';

import {setNavigationBlocked} from 'actions/admin_actions.jsx';
import {openModal} from 'actions/views/modals';

import SystemUserDetail from './system_user_detail';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const license = getLicense(state);
    const isLicensed = license.IsLicensed === 'true';
    const isProOrEnterprise = license.SkuShortName === LicenseSkus.Professional || license.SkuShortName === LicenseSkus.Enterprise || license.SkuShortName === LicenseSkus.E20;
    const canAdminManageUserSettings = isLicensed && isProOrEnterprise;

    return {
        mfaEnabled: config?.EnableMultifactorAuthentication === 'true' || false,
        canAdminManageUserSettings,
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
