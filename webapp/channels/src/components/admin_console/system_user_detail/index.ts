// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getCustomProfileAttributeFields} from 'mattermost-redux/actions/general';
import {getUserPreferences} from 'mattermost-redux/actions/preferences';
import {addUserToTeam} from 'mattermost-redux/actions/teams';
import {updateUserActive, getUser, patchUser, updateUserMfa, getCustomProfileAttributeValues, saveCustomProfileAttribute} from 'mattermost-redux/actions/users';
import {getConfig, getCustomProfileAttributes, getLicense, isCustomProfileAttributesEnabled} from 'mattermost-redux/selectors/entities/general';

import {setNavigationBlocked} from 'actions/admin_actions.jsx';
import {openModal} from 'actions/views/modals';
import {getShowLockedManageUserSettings, getShowManageUserSettings} from 'selectors/admin_console';

import {isEnterpriseLicense} from 'utils/license_utils';

import SystemUserDetail from './system_user_detail';

function mapStateToProps(state: GlobalState) {
    const license = getLicense(state);
    const config = getConfig(state);
    const customProfileAttributeEnabled = isEnterpriseLicense(license) && isCustomProfileAttributesEnabled(state);
    const customProfileAttributeFields = customProfileAttributeEnabled ? Object.values(getCustomProfileAttributes(state)) : [];

    const showManageUserSettings = getShowManageUserSettings(state);
    const showLockedManageUserSettings = getShowLockedManageUserSettings(state);

    return {
        mfaEnabled: config?.EnableMultifactorAuthentication === 'true' || false,
        customProfileAttributeEnabled,
        customProfileAttributeFields,
        showManageUserSettings,
        showLockedManageUserSettings,
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
    getCustomProfileAttributeFields,
    getCustomProfileAttributeValues,
    saveCustomProfileAttribute,
};
const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;
export default connector(SystemUserDetail);
