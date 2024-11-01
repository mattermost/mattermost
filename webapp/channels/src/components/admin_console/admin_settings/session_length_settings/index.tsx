// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import SettingsGroup from 'components/admin_console/settings_group';

import {FIELD_IDS} from './constants';
import ExtendSessionLengthWithActivity from './extended_session_length_with_activity';
import {messages} from './messages';
import SessionCacheInMinutes from './session_cache_in_minutes';
import SessionIdleTimeoutInMinutes from './session_idle_timeout_in_minutes';
import SessionLengthMobileInHours from './session_length_mobile_in_hours';
import SessionLengthSSOInHours from './session_length_sso_in_hours';
import SessionLengthWebInHours from './session_length_web_in_hours';
import TerminateSessionsOnPasswordChange from './terminate_session_on_password_change';

import AdminSetting from '../admin_settings';
import {useAdminSettingState} from '../hooks';
import type {GetConfigFromStateFunction, GetStateFromConfigFunction} from '../types';
import {parseIntNonZero, parseIntZeroOrMin} from '../utils';

export {searchableStrings} from './messages';

const getConfigFromState: GetConfigFromStateFunction = (state) => {
    const MINIMUM_IDLE_TIMEOUT = 5;

    return {
        ServiceSettings: {
            ExtendSessionLengthWithActivity: state[FIELD_IDS.EXTEND_SESSION_LENGTH_WITH_ACTIVITY].extendSessionLengthWithActivity,
            TerminateSessionsOnPasswordChange: state[FIELD_IDS.TERMINATE_SESSIONS_ON_PASSWORD_CHANGE].terminateSessionsOnPasswordChange,
            SessionLengthWebInHours: parseIntNonZero(state[FIELD_IDS.SESSION_LENGTH_WEB_IN_HOURS]),
            SessionLengthMobileInHours: parseIntNonZero(state[FIELD_IDS.SESSION_LENGTH_MOBILE_IN_HOURS]),
            SessionLengthSSOInHours: parseIntNonZero(state[FIELD_IDS.SESSION_LENGTH_SSO_IN_HOURS]),
            SessionCacheInMinutes: parseIntNonZero(state[FIELD_IDS.SESSION_CACHE_IN_MINUTES]),
            SessionIdleTimeoutInMinutes: parseIntZeroOrMin(state[FIELD_IDS.SESSION_IDLE_TIMEOUT_IN_MINUTES], MINIMUM_IDLE_TIMEOUT),
        },
    };
};

const getStateFromConfig: GetStateFromConfigFunction = (config) => {
    return {
        [FIELD_IDS.EXTEND_SESSION_LENGTH_WITH_ACTIVITY]: config.ServiceSettings.ExtendSessionLengthWithActivity,
        [FIELD_IDS.TERMINATE_SESSIONS_ON_PASSWORD_CHANGE]: config.ServiceSettings.TerminateSessionsOnPasswordChange,
        [FIELD_IDS.SESSION_LENGTH_WEB_IN_HOURS]: config.ServiceSettings.SessionLengthWebInHours,
        [FIELD_IDS.SESSION_LENGTH_MOBILE_IN_HOURS]: config.ServiceSettings.SessionLengthMobileInHours,
        [FIELD_IDS.SESSION_LENGTH_SSO_IN_HOURS]: config.ServiceSettings.SessionLengthSSOInHours,
        [FIELD_IDS.SESSION_CACHE_IN_MINUTES]: config.ServiceSettings.SessionCacheInMinutes,
        [FIELD_IDS.SESSION_IDLE_TIMEOUT_IN_MINUTES]: config.ServiceSettings.SessionIdleTimeoutInMinutes,
    };
};

function renderTitle() {
    return (
        <FormattedMessage {...messages.title}/>
    );
}

type Props = {
    isDisabled?: boolean;
}

const SessionLengthSettings = ({
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

    const renderSettings = useCallback(() => {
        return (
            <SettingsGroup>
                <ExtendSessionLengthWithActivity
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.EXTEND_SESSION_LENGTH_WITH_ACTIVITY]}
                    isDisabled={isDisabled}
                />
                <TerminateSessionsOnPasswordChange
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.TERMINATE_SESSIONS_ON_PASSWORD_CHANGE]}
                    isDisabled={isDisabled}
                />
                <SessionLengthWebInHours
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.SESSION_LENGTH_WEB_IN_HOURS]}
                    isDisabled={isDisabled}
                    extendSessionLengthWithActivity={settingValues[FIELD_IDS.EXTEND_SESSION_LENGTH_WITH_ACTIVITY]}
                />
                <SessionLengthMobileInHours
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.SESSION_LENGTH_MOBILE_IN_HOURS]}
                    isDisabled={isDisabled}
                    extendSessionLengthWithActivity={settingValues[FIELD_IDS.EXTEND_SESSION_LENGTH_WITH_ACTIVITY]}
                />
                <SessionLengthSSOInHours
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.SESSION_LENGTH_SSO_IN_HOURS]}
                    isDisabled={isDisabled}
                    extendSessionLengthWithActivity={settingValues[FIELD_IDS.EXTEND_SESSION_LENGTH_WITH_ACTIVITY]}
                />
                <SessionCacheInMinutes
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.SESSION_CACHE_IN_MINUTES]}
                    isDisabled={isDisabled}
                />
                <SessionIdleTimeoutInMinutes
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.SESSION_IDLE_TIMEOUT_IN_MINUTES]}
                    isDisabled={isDisabled}
                    extendSessionLengthWithActivity={settingValues[FIELD_IDS.EXTEND_SESSION_LENGTH_WITH_ACTIVITY]}
                />
            </SettingsGroup>
        );
    }, [handleChange, isDisabled, settingValues]);

    return (
        <AdminSetting
            doSubmit={doSubmit}
            renderSettings={renderSettings}
            renderTitle={renderTitle}
            saveNeeded={saveNeeded}
            saving={saving}
            isDisabled={isDisabled}
            serverError={serverError}
        />
    );
};

export default SessionLengthSettings;
