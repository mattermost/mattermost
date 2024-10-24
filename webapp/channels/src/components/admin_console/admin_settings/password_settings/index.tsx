// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/admin';

import Setting from 'components/admin_console/setting';
import SettingsGroup from 'components/admin_console/settings_group';

import Constants from 'utils/constants';
import {passwordErrors} from 'utils/password';

import type {GlobalState} from 'types/store';

import {FIELD_IDS} from './constants';
import Lowercase from './lowercase';
import MaximumLoginAttempts from './maximum_login_attempts';
import {messages} from './messages';
import Number from './number';
import PasswordEnableForgotLink from './password_enable_fogot_link';
import PasswordMinimumLength from './password_minimum_length';
import Symbol from './symbol';
import Uppercase from './uppercase';

import AdminSetting from '../admin_settings';
import {useAdminSettingState} from '../hooks';
import type {GetConfigFromStateFunction, GetStateFromConfigFunction} from '../types';
import {parseIntNonZero} from '../utils';

export {searchableStrings} from './messages';

function getPasswordErrorsMessage(lowercase?: boolean, uppercase?: boolean, number?: boolean, symbol?: boolean) {
    type KeyType = keyof typeof passwordErrors;

    let key: KeyType = 'passwordError';

    if (lowercase) {
        key += 'Lowercase';
    }
    if (uppercase) {
        key += 'Uppercase';
    }
    if (number) {
        key += 'Number';
    }
    if (symbol) {
        key += 'Symbol';
    }

    return passwordErrors[key as KeyType];
}

const renderTitle = () => <FormattedMessage {...messages.password}/>;

const getConfigFromState: GetConfigFromStateFunction = (state) => {
    return {
        PasswordSettings: {
            MinimumLength: parseIntNonZero(state[FIELD_IDS.PASSWORD_MINIMUM_LENGTH] ?? '', Constants.MIN_PASSWORD_LENGTH),
            Lowercase: state[FIELD_IDS.PASSWORD_LOWERCASE],
            Uppercase: state[FIELD_IDS.PASSWORD_UPPERCASE],
            Number: state[FIELD_IDS.PASSWORD_NUMBER],
            Symbol: state[FIELD_IDS.PASSWORD_SYMBOL],
            EnableForgotLink: state[FIELD_IDS.PASSWORD_ENABLE_FORGOT_LINK],
        },
        ServiceSettings: {
            MaximumLoginAttempts: parseIntNonZero(state[FIELD_IDS.MAXIMUM_LOGIN_ATTEMPTS] ?? '', Constants.MAXIMUM_LOGIN_ATTEMPTS_DEFAULT),
        },
    };
};

const getStateFromConfig: GetStateFromConfigFunction = (config) => {
    return {
        [FIELD_IDS.PASSWORD_MINIMUM_LENGTH]: String(config.PasswordSettings?.MinimumLength),
        [FIELD_IDS.PASSWORD_LOWERCASE]: config.PasswordSettings?.Lowercase,
        [FIELD_IDS.PASSWORD_NUMBER]: config.PasswordSettings?.Number,
        [FIELD_IDS.PASSWORD_UPPERCASE]: config.PasswordSettings?.Uppercase,
        [FIELD_IDS.PASSWORD_SYMBOL]: config.PasswordSettings?.Symbol,
        [FIELD_IDS.PASSWORD_ENABLE_FORGOT_LINK]: config.PasswordSettings?.EnableForgotLink,
        [FIELD_IDS.MAXIMUM_LOGIN_ATTEMPTS]: String(config.ServiceSettings?.MaximumLoginAttempts),
    };
};

type Props = {
    isDisabled?: boolean;
}

const requirementsSettingLabel = <FormattedMessage {...messages.passwordRequirements}/>;

const PasswordSettings = ({
    isDisabled,
}: Props) => {
    const restrictSystemAdmin = useSelector((state: GlobalState) => getConfig(state).ExperimentalSettings?.RestrictSystemAdmin);
    const passwordMinimumLength = useSelector((state: GlobalState) => getConfig(state).PasswordSettings?.MinimumLength || 0);
    const {
        doSubmit,
        handleChange,
        saveNeeded,
        saving,
        serverError,
        settingValues,
    } = useAdminSettingState(getConfigFromState, getStateFromConfig);

    const requirementSettings = useMemo(() => {
        const getSampleErrorMsg = () => {
            if (passwordMinimumLength > Constants.MAX_PASSWORD_LENGTH || passwordMinimumLength < Constants.MIN_PASSWORD_LENGTH) {
                return (<FormattedMessage {...messages.passwordMinLength}/>);
            }
            return (
                <FormattedMessage
                    {...getPasswordErrorsMessage(
                        settingValues[FIELD_IDS.PASSWORD_LOWERCASE],
                        settingValues[FIELD_IDS.PASSWORD_UPPERCASE],
                        settingValues[FIELD_IDS.PASSWORD_NUMBER],
                        settingValues[FIELD_IDS.PASSWORD_SYMBOL],
                    )}
                    values={{
                        min: (settingValues[FIELD_IDS.PASSWORD_MINIMUM_LENGTH] || Constants.MIN_PASSWORD_LENGTH),
                        max: Constants.MAX_PASSWORD_LENGTH,
                    }}
                />
            );
        };

        return (
            <>
                <div>
                    <Lowercase
                        onChange={handleChange}
                        value={settingValues[FIELD_IDS.PASSWORD_LOWERCASE]}
                        isDisabled={isDisabled}
                    />
                </div>
                <div>
                    <Uppercase
                        onChange={handleChange}
                        value={settingValues[FIELD_IDS.PASSWORD_UPPERCASE]}
                        isDisabled={isDisabled}
                    />
                </div>
                <div>
                    <Number
                        onChange={handleChange}
                        value={settingValues[FIELD_IDS.PASSWORD_NUMBER]}
                        isDisabled={isDisabled}
                    />
                </div>
                <div>
                    <Symbol
                        onChange={handleChange}
                        value={settingValues[FIELD_IDS.PASSWORD_SYMBOL]}
                        isDisabled={isDisabled}
                    />
                </div>
                <div>
                    <br/>
                    <label>
                        <FormattedMessage {...messages.preview}/>
                    </label>
                    <br/>
                    {getSampleErrorMsg()}
                </div>
            </>
        );
    }, [handleChange, isDisabled, passwordMinimumLength, settingValues]);

    const renderSettings = useCallback(() => {
        return (
            <SettingsGroup>
                <div>
                    <PasswordMinimumLength
                        onChange={handleChange}
                        value={settingValues[FIELD_IDS.PASSWORD_MINIMUM_LENGTH] || ''}
                        isDisabled={isDisabled}
                    />
                    <Setting label={requirementsSettingLabel}>
                        {requirementSettings}
                    </Setting>
                </div>
                {!restrictSystemAdmin && (
                    <MaximumLoginAttempts
                        onChange={handleChange}
                        value={settingValues[FIELD_IDS.MAXIMUM_LOGIN_ATTEMPTS] || ''}
                        isDisabled={isDisabled}
                    />
                )}
                <PasswordEnableForgotLink
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.PASSWORD_ENABLE_FORGOT_LINK] ?? false}
                    isDisabled={isDisabled}
                />
            </SettingsGroup>
        );
    }, [handleChange, isDisabled, requirementSettings, restrictSystemAdmin, settingValues]);

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

export default PasswordSettings;
