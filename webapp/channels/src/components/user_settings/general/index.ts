// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';

import {clearErrors, logError} from 'mattermost-redux/actions/errors';
import {
    updateMe,
    sendVerificationEmail,
    setDefaultProfileImage,
    uploadProfileImage,
} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import type {ActionFunc} from 'mattermost-redux/types/actions';

import {getIsMobileView} from 'selectors/views/browser';

import type {GlobalState} from 'types/store';

import UserSettingsGeneralTab from './user_settings_general';
import type {Props} from './user_settings_general';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);

    const requireEmailVerification = config.RequireEmailVerification === 'true';
    const maxFileSize = parseInt(config.MaxFileSize!, 10);
    const ldapFirstNameAttributeSet = config.LdapFirstNameAttributeSet === 'true';
    const ldapLastNameAttributeSet = config.LdapLastNameAttributeSet === 'true';
    const samlFirstNameAttributeSet = config.SamlFirstNameAttributeSet === 'true';
    const samlLastNameAttributeSet = config.SamlLastNameAttributeSet === 'true';
    const ldapNicknameAttributeSet = config.LdapNicknameAttributeSet === 'true';
    const samlNicknameAttributeSet = config.SamlNicknameAttributeSet === 'true';
    const samlPositionAttributeSet = config.SamlPositionAttributeSet === 'true';
    const ldapPositionAttributeSet = config.LdapPositionAttributeSet === 'true';
    const ldapPictureAttributeSet = config.LdapPictureAttributeSet === 'true';

    return {
        isMobileView: getIsMobileView(state),
        requireEmailVerification,
        maxFileSize,
        ldapFirstNameAttributeSet,
        ldapLastNameAttributeSet,
        samlFirstNameAttributeSet,
        samlLastNameAttributeSet,
        ldapNicknameAttributeSet,
        samlNicknameAttributeSet,
        samlPositionAttributeSet,
        ldapPositionAttributeSet,
        ldapPictureAttributeSet,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Props['actions']>({
            logError,
            clearErrors,
            updateMe,
            sendVerificationEmail,
            setDefaultProfileImage,
            uploadProfileImage,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(UserSettingsGeneralTab);
