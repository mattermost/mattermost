// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';

import {getAuthorizedOAuthApps, deauthorizeOAuthApp} from 'mattermost-redux/actions/integrations';
import {getMe, updateUserPassword} from 'mattermost-redux/actions/users';
import {getConfig, getPasswordConfig} from 'mattermost-redux/selectors/entities/general';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import * as UserUtils from 'mattermost-redux/utils/user_utils';

import {Preferences} from 'utils/constants';

import SecurityTab from './user_settings_security';

type Props = {
    user: UserProfile;
    activeSection?: string;
    updateSection: (section: string) => void;
    closeModal: () => void;
    collapseModal: () => void;
    setRequireConfirm: () => void;
};

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const config = getConfig(state);

    const tokensEnabled = config.EnableUserAccessTokens === 'true';
    const userHasTokenRole = UserUtils.hasUserAccessTokenRole(ownProps.user.roles) || UserUtils.isSystemAdmin(ownProps.user.roles);

    const enableOAuthServiceProvider = config.EnableOAuthServiceProvider === 'true';
    const allowedToSwitchToEmail = config.EnableSignUpWithEmail === 'true' && (config.EnableSignInWithEmail === 'true' || config.EnableSignInWithUsername === 'true');
    const enableSignUpWithGitLab = config.EnableSignUpWithGitLab === 'true';
    const enableSignUpWithGoogle = config.EnableSignUpWithGoogle === 'true';
    const enableSignUpWithOpenId = config.EnableSignUpWithOpenId === 'true';
    const enableLdap = config.EnableLdap === 'true';
    const enableSaml = config.EnableSaml === 'true';
    const enableSignUpWithOffice365 = config.EnableSignUpWithOffice365 === 'true';
    const experimentalEnableAuthenticationTransfer = config.ExperimentalEnableAuthenticationTransfer === 'true';

    return {
        canUseAccessTokens: tokensEnabled && userHasTokenRole,
        enableOAuthServiceProvider,
        allowedToSwitchToEmail,
        enableSignUpWithGitLab,
        enableSignUpWithGoogle,
        enableSignUpWithOpenId,
        enableLdap,
        enableSaml,
        enableSignUpWithOffice365,
        experimentalEnableAuthenticationTransfer,
        passwordConfig: getPasswordConfig(state),
        militaryTime: getBool(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getMe,
            updateUserPassword,
            getAuthorizedOAuthApps,
            deauthorizeOAuthApp,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SecurityTab);
