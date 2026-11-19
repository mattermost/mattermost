// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';
import type {IntlShape, MessageDescriptor} from 'react-intl';

export type SystemSettingValueType = 'bool' | 'string' | 'number' | 'select';

export interface SystemSettingSelectOption {
    value: string;
    label: MessageDescriptor;
}

export interface SystemSettingConfigDefinition {
    key: string;
    label: MessageDescriptor;
    description: MessageDescriptor;
    valueType: SystemSettingValueType;
    defaultValue: string;
    options?: SystemSettingSelectOption[];
}

export const SCOPED_CONFIGURATION_LIST_ROUTE = '/admin_console/system_attributes/scoped_configuration';
export const SCOPED_CONFIGURATION_EDIT_ROUTE = '/admin_console/system_attributes/scoped_configuration/edit_policy';

export function getScopedConfigurationPrefillRoute(settingKey: string): string {
    return `${SCOPED_CONFIGURATION_EDIT_ROUTE}/setting/${encodeURIComponent(settingKey)}`;
}

const settingMessages = defineMessages({
    mobileEnableBiometricsLabel: {
        id: 'admin.scoped_configuration.setting.mobile_enable_biometrics.label',
        defaultMessage: 'Enable Biometric Authentication',
    },
    mobileEnableBiometricsDescription: {
        id: 'admin.scoped_configuration.setting.mobile_enable_biometrics.description',
        defaultMessage: 'Enforce biometric authentication before accessing the mobile app',
    },
    boolTrue: {
        id: 'admin.true',
        defaultMessage: 'True',
    },
    boolFalse: {
        id: 'admin.false',
        defaultMessage: 'False',
    },
});

export const AVAILABLE_SYSTEM_SETTINGS: SystemSettingConfigDefinition[] = [
    {
        key: 'MobileEnableBiometrics',
        label: settingMessages.mobileEnableBiometricsLabel,
        description: settingMessages.mobileEnableBiometricsDescription,
        valueType: 'bool',
        defaultValue: 'true',
    },
];

export function getSystemSettingDefinition(key: string): SystemSettingConfigDefinition | undefined {
    return AVAILABLE_SYSTEM_SETTINGS.find((item) => item.key === key);
}

export function isValidSystemSettingValue(def: SystemSettingConfigDefinition, value: string): boolean {
    switch (def.valueType) {
    case 'bool':
        return value === 'true' || value === 'false';
    case 'number':
        return (/^-?\d+$/).test(value.trim());
    case 'select':
        return Boolean(def.options?.some((opt) => opt.value === value));
    case 'string':
        return true;
    default:
        return false;
    }
}

export function formatSystemSettingRuleSummary(
    key: string,
    value: string | undefined,
    formatMessage: IntlShape['formatMessage'],
): string {
    const def = getSystemSettingDefinition(key);
    const label = def ? formatMessage(def.label) : key;
    if (value === undefined) {
        return label;
    }

    let formattedValue = value;
    if (def?.valueType === 'bool') {
        formattedValue = value === 'true' ? formatMessage(settingMessages.boolTrue) : formatMessage(settingMessages.boolFalse);
    } else if (def?.valueType === 'select') {
        const opt = def.options?.find((o) => o.value === value);
        if (opt) {
            formattedValue = formatMessage(opt.label);
        }
    }

    return `${label}: ${formattedValue}`;
}
