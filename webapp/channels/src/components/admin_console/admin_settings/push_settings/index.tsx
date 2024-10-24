// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getEnvironmentConfig} from 'mattermost-redux/selectors/entities/admin';

import SettingsGroup from 'components/admin_console/settings_group';

import {Constants} from 'utils/constants';

import type {GlobalState} from 'types/store';

import {FIELD_IDS, PUSH_NOTIFICATIONS_CUSTOM, PUSH_NOTIFICATIONS_LOCATION_DE, PUSH_NOTIFICATIONS_LOCATION_US, PUSH_NOTIFICATIONS_MHPNS, PUSH_NOTIFICATIONS_MTPNS, PUSH_NOTIFICATIONS_OFF} from './constants';
import MaxNotificationsPerChannel from './max_notifications_per_channel';
import {messages} from './messages';
import PushNotificationServer from './push_notification_server';
import PushNotificationServerLocation from './push_notification_server_location';
import PushNotificationServerType from './push_notification_server_type';
import TOSCheckbox from './tos_checkbox';

import AdminSetting from '../admin_settings';
import {useAdminSettingState} from '../hooks';
import type {GetConfigFromStateFunction, GetStateFromConfigFunction} from '../types';
import {isSetByEnv} from '../utils';

export {searchableStrings} from './messages';

const PUSH_NOTIFICATIONS_SERVER_DIC: {[x: string]: string} = {
    [PUSH_NOTIFICATIONS_LOCATION_US]: Constants.MHPNS_US,
    [PUSH_NOTIFICATIONS_LOCATION_DE]: Constants.MHPNS_DE,
};

const getConfigFromState: GetConfigFromStateFunction = (state) => {
    return {
        EmailSettings: {
            SendPushNotifications: state[FIELD_IDS.PUSH_NOTIFICATION_SERVER_TYPE] !== PUSH_NOTIFICATIONS_OFF,
            PushNotificationServer: state[FIELD_IDS.PUSH_NOTIFICATION_SERVER].trim(),
        },
        TeamSettings: {
            MaxNotificationsPerChannel: state[FIELD_IDS.MAX_NOTIFICATIONS_PER_CHANNEL],
        },
    };
};

const getStateFromConfig: GetStateFromConfigFunction = (config, license) => {
    let pushNotificationServerType = PUSH_NOTIFICATIONS_CUSTOM;
    let agree = false;
    let pushNotificationServerLocation = PUSH_NOTIFICATIONS_LOCATION_US;
    if (!config.EmailSettings.SendPushNotifications) {
        pushNotificationServerType = PUSH_NOTIFICATIONS_OFF;
    } else if (config.EmailSettings.PushNotificationServer === Constants.MHPNS_US &&
        license.IsLicensed === 'true' && license.MHPNS === 'true') {
        pushNotificationServerType = PUSH_NOTIFICATIONS_MHPNS;
        pushNotificationServerLocation = PUSH_NOTIFICATIONS_LOCATION_US;
        agree = true;
    } else if (config.EmailSettings.PushNotificationServer === Constants.MHPNS_DE &&
        license.IsLicensed === 'true' && license.MHPNS === 'true') {
        pushNotificationServerType = PUSH_NOTIFICATIONS_MHPNS;
        pushNotificationServerLocation = PUSH_NOTIFICATIONS_LOCATION_DE;
        agree = true;
    } else if (config.EmailSettings.PushNotificationServer === Constants.MTPNS) {
        pushNotificationServerType = PUSH_NOTIFICATIONS_MTPNS;
    }

    let pushNotificationServer = config.EmailSettings.PushNotificationServer;
    if (pushNotificationServerType === PUSH_NOTIFICATIONS_MTPNS) {
        pushNotificationServer = Constants.MTPNS;
    } else if (pushNotificationServerType === PUSH_NOTIFICATIONS_MHPNS) {
        pushNotificationServer = PUSH_NOTIFICATIONS_SERVER_DIC[pushNotificationServerLocation];
    }

    const maxNotificationsPerChannel = config.TeamSettings.MaxNotificationsPerChannel;

    return {
        [FIELD_IDS.PUSH_NOTIFICATION_SERVER_TYPE]: pushNotificationServerType,
        [FIELD_IDS.PUSH_NOTIFICATION_SERVER_LOCATION]: pushNotificationServerLocation,
        [FIELD_IDS.PUSH_NOTIFICATION_SERVER]: pushNotificationServer,
        [FIELD_IDS.MAX_NOTIFICATIONS_PER_CHANNEL]: maxNotificationsPerChannel,
        [FIELD_IDS.AGREE]: agree,
    };
};

function renderTitle() {
    return (<FormattedMessage {...messages.pushNotificationServer}/>);
}

type Props = {
    isDisabled?: boolean;
}

const PushSettings = ({
    isDisabled,
}: Props) => {
    const {
        doSubmit,
        handleChange,
        saveNeeded,
        saving,
        serverError,
        settingValues,
    } = useAdminSettingState(getConfigFromState, getStateFromConfig);

    const isPushNotificationServerSetByEnv = useSelector((state: GlobalState) => {
        const env = getEnvironmentConfig(state);

        // Assume that if one of these has been set using an environment variable,
        // all of them have been set that way
        return isSetByEnv(env, 'EmailSettings.SendPushNotifications') || isSetByEnv(env, 'EmailSettings.PushNotificationServer');
    });

    const canSave = settingValues[FIELD_IDS.PUSH_NOTIFICATION_SERVER_TYPE] !== PUSH_NOTIFICATIONS_MHPNS || settingValues[FIELD_IDS.AGREE];
    const isMHPNS = settingValues[FIELD_IDS.PUSH_NOTIFICATION_SERVER_TYPE] === PUSH_NOTIFICATIONS_MHPNS;

    const handleServerTypeChange = useCallback((id: string, value: string) => {
        handleChange(FIELD_IDS.AGREE, false);

        const serverType = settingValues[FIELD_IDS.PUSH_NOTIFICATION_SERVER_TYPE];
        const serverLocation = settingValues[FIELD_IDS.PUSH_NOTIFICATION_SERVER_LOCATION];
        if (value === PUSH_NOTIFICATIONS_MHPNS) {
            handleChange(FIELD_IDS.PUSH_NOTIFICATION_SERVER, PUSH_NOTIFICATIONS_SERVER_DIC[serverLocation]);
        } else if (value === PUSH_NOTIFICATIONS_MTPNS) {
            handleChange(FIELD_IDS.PUSH_NOTIFICATION_SERVER, Constants.MTPNS);
        } else if (value === PUSH_NOTIFICATIONS_CUSTOM &&
            (serverType === PUSH_NOTIFICATIONS_MTPNS ||
            serverType === PUSH_NOTIFICATIONS_MHPNS)) {
            handleChange(FIELD_IDS.PUSH_NOTIFICATION_SERVER, '');
        }

        handleChange(id, value);
    }, [handleChange, settingValues]);

    const handleServerLocationChange = useCallback((id: string, value: string) => {
        handleChange(FIELD_IDS.PUSH_NOTIFICATION_SERVER, PUSH_NOTIFICATIONS_SERVER_DIC[value]);
        handleChange(id, value);
    }, [handleChange]);

    const renderSettings = useCallback(() => {
        return (
            <SettingsGroup>
                <PushNotificationServerType
                    isSetByEnv={isPushNotificationServerSetByEnv}
                    onChange={handleServerTypeChange}
                    value={settingValues[FIELD_IDS.PUSH_NOTIFICATION_SERVER_LOCATION]}
                    isDisabled={isDisabled}
                />
                <PushNotificationServerLocation
                    isMHPNS={isMHPNS}
                    isSetByEnv={isPushNotificationServerSetByEnv}
                    onChange={handleServerLocationChange}
                    value={settingValues[FIELD_IDS.PUSH_NOTIFICATION_SERVER_LOCATION]}
                    isDisabled={isDisabled}
                />
                <TOSCheckbox
                    isMHPNS={isMHPNS}
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.AGREE]}
                    isDisabled={isDisabled}
                />
                <PushNotificationServer
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.PUSH_NOTIFICATION_SERVER]}
                    isDisabled={isDisabled}
                    serverType={settingValues[FIELD_IDS.PUSH_NOTIFICATION_SERVER_TYPE]}
                />
                <MaxNotificationsPerChannel
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.MAX_NOTIFICATIONS_PER_CHANNEL]}
                    isDisabled={isDisabled}
                />
            </SettingsGroup>
        );
    }, [
        handleChange,
        handleServerLocationChange,
        handleServerTypeChange,
        isDisabled,
        isMHPNS,
        isPushNotificationServerSetByEnv,
        settingValues,
    ]);

    return (
        <AdminSetting
            doSubmit={doSubmit}
            renderSettings={renderSettings}
            renderTitle={renderTitle}
            saveNeeded={saveNeeded}
            saving={saving}
            isDisabled={isDisabled || !canSave}
            serverError={serverError}
        />
    );
};

export default PushSettings;
