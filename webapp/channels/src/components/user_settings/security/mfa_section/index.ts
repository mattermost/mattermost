// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {deactivateMfa} from 'actions/views/mfa';

import Constants from 'utils/constants';

import MfaSection from './mfa_section';

import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';
import type {ActionFunc} from 'mattermost-redux/types/actions';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';

type Actions = {
    deactivateMfa: () => Promise<{error?: {message: string}}>;
}

function mapStateToProps(state: GlobalState) {
    const license = getLicense(state);
    const config = getConfig(state);
    const mfaLicensed = license && license.IsLicensed === 'true' && license.MFA === 'true';
    const mfaEnabled = config.EnableMultifactorAuthentication === 'true';
    const mfaEnforced = mfaLicensed && config.EnforceMultifactorAuthentication === 'true';
    const user: UserProfile = getCurrentUser(state);
    let mfaActive = false;
    let mfaAvailable = false;
    if (user) {
        mfaActive = (user as any).mfa_active;
        mfaAvailable = mfaEnabled && (user.auth_service === '' || user.auth_service === Constants.LDAP_SERVICE);
    }
    return {
        mfaActive,
        mfaAvailable,
        mfaEnforced,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            deactivateMfa,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(MfaSection);
