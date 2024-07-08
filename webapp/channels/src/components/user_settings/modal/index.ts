// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {lazy} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {sendVerificationEmail} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getUserPreferences} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser, getUser} from 'mattermost-redux/selectors/entities/users';

import {getPluginUserSettings} from 'selectors/plugins';

import {makeAsyncComponent} from 'components/async_load';

import type {GlobalState} from 'types/store';

const UserSettingsModalAsync = makeAsyncComponent('UserSettingsModal', lazy(() => import('./user_settings_modal')));

import type {OwnProps} from './user_settings_modal';

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const config = getConfig(state);

    const sendEmailNotifications = config.SendEmailNotifications === 'true';
    const requireEmailVerification = config.RequireEmailVerification === 'true';

    return {
        currentUser: ownProps.adminMode && ownProps.userID ? getUser(state, ownProps.userID) : getCurrentUser(state),
        userPreferences: ownProps.adminMode && ownProps.userID ? getUserPreferences(state, ownProps.userID) : undefined,
        sendEmailNotifications,
        requireEmailVerification,
        pluginSettings: getPluginUserSettings(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            sendVerificationEmail,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(UserSettingsModalAsync);
