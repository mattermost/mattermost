// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect, type ConnectedProps} from 'react-redux';

import type {PreferencesType} from '@mattermost/types/preferences';
import type {UserProfile} from '@mattermost/types/users';

import {patchUser, updateMe} from 'mattermost-redux/actions/users';
import {getSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {
    isCollapsedThreadsEnabled,
    isCollapsedThreadsEnabledForUser,
} from 'mattermost-redux/selectors/entities/preferences';

import {isCallsEnabled, isCallsRingingEnabledOnServer} from 'selectors/calls';

import {isEnterpriseOrCloudOrSKUStarterFree} from 'utils/license_utils';

import type {GlobalState} from 'types/store';

import UserSettingsNotifications from './user_settings_notifications';

export type OwnProps = {
    user: UserProfile;
    updateSection: (section: string) => void;
    activeSection: string;
    closeModal: () => void;
    collapseModal: () => void;
    adminMode?: boolean;
    userPreferences?: PreferencesType;
}

const mapStateToProps = (state: GlobalState, props: OwnProps) => {
    // server config, related to server configuration, not the user
    const config = getConfig(state);

    const sendPushNotifications = config.SendPushNotifications === 'true';
    const enableAutoResponder = config.ExperimentalEnableAutomaticReplies === 'true';

    const license = getLicense(state);
    const subscriptionProduct = getSubscriptionProduct(state);

    const isEnterpriseReady = config.BuildEnterpriseReady === 'true';

    return {
        sendPushNotifications,
        enableAutoResponder,
        isCollapsedThreadsEnabled: props.adminMode && props.userPreferences ? isCollapsedThreadsEnabledForUser(state, props.userPreferences) : isCollapsedThreadsEnabled(state),
        isCallsRingingEnabled: isCallsEnabled(state, '0.17.0') && isCallsRingingEnabledOnServer(state),
        isEnterpriseOrCloudOrSKUStarterFree: isEnterpriseOrCloudOrSKUStarterFree(license, subscriptionProduct, isEnterpriseReady),
        isEnterpriseReady,
    };
};

const mapDispatchToProps = {
    updateMe,
    patchUser,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(UserSettingsNotifications);
