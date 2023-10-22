// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect, type ConnectedProps} from 'react-redux';

import {updateMe} from 'mattermost-redux/actions/users';
import {getSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {isCallsEnabled, isCallsRingingEnabledOnServer} from 'selectors/calls';

import {CloudProducts, SelfHostedProducts} from 'utils/constants';
import {isCloudLicense} from 'utils/license_utils';

import type {GlobalState} from 'types/store';

import UserSettingsNotifications from './user_settings_notifications';

const mapStateToProps = (state: GlobalState) => {
    const config = getConfig(state);

    const sendPushNotifications = config.SendPushNotifications === 'true';
    const enableAutoResponder = config.ExperimentalEnableAutomaticReplies === 'true';

    const license = getLicense(state);
    const subscriptionProduct = getSubscriptionProduct(state);

    const isCloud = isCloudLicense(license);
    const isCloudStarterFree = isCloud && subscriptionProduct?.sku === CloudProducts.STARTER;

    const isEnterpriseReady = config.BuildEnterpriseReady === 'true';
    const isSelfHostedStarter = isEnterpriseReady && (license.IsLicensed === 'false');

    const isStarterSKULicense = license.IsLicensed === 'true' && license.SelfHostedProducts === SelfHostedProducts.STARTER;

    const isStarterFree = isCloudStarterFree || isSelfHostedStarter || isStarterSKULicense;

    const areFeaturesDisabled = isStarterFree || !isEnterpriseReady;

    return {
        sendPushNotifications,
        enableAutoResponder,
        isCollapsedThreadsEnabled: isCollapsedThreadsEnabled(state),
        isCallsRingingEnabled: isCallsEnabled(state, '0.17.0') && isCallsRingingEnabledOnServer(state),
        areFeaturesDisabled,
    };
};

const mapDispatchToProps = {
    updateMe,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(UserSettingsNotifications);
