// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl, defineMessages} from 'react-intl';

import type {LdapDiagnosticResult} from '@mattermost/types/admin';
import type {AdminConfig} from '@mattermost/types/config';

import TextSetting from 'components/admin_console/text_setting';
import FormError, {TYPE_BACKSTAGE} from 'components/form_error';
import WithTooltip from 'components/with_tooltip';

import Constants from 'utils/constants';

import {renderLDAPSettingHelpText} from './ldap_helpers';
import type {GeneralSettingProps} from './ldap_wizard';

import {renderLabel} from '../schema_admin_settings';

type TextSettingProps = {
    config: Partial<AdminConfig>;
    state: Record<string, unknown>;
    placeholder?: string | MessageDescriptor;
    onChange(id: string, value: any): void;
    disabled: boolean;
    setByEnv: boolean;
    filterResult: LdapDiagnosticResult | null;
} & GeneralSettingProps

const LDAPTextSetting = (props: TextSettingProps) => {
    const intl = useIntl();

    if (!props.schema || !props.setting.key || (props.setting.type !== 'text' && props.setting.type !== 'longtext' && props.setting.type !== 'number')) {
        return null;
    }

    let inputType: 'text' | 'number' | 'textarea' = 'text';
    if (props.setting.type === Constants.SettingsTypes.TYPE_NUMBER) {
        inputType = 'number';
    } else if (props.setting.type === Constants.SettingsTypes.TYPE_LONG_TEXT) {
        inputType = 'textarea';
    }

    let value: string;
    if (props.setting.dynamic_value) {
        const baseValue = props.state[props.setting.key] ?? (props.setting.default || '');
        const dynamicValue = props.setting.dynamic_value(baseValue, props.config, props.state);
        value = sanitizeValue(dynamicValue);
    } else if (props.setting.multiple) {
        const arrayValue = props.state[props.setting.key] ? (props.state[props.setting.key] as string[]).join(',') : '';
        value = sanitizeValue(arrayValue);
    } else {
        const rawValue = (props.state[props.setting.key] as string) ?? (props.setting.default as string || '');
        value = sanitizeValue(rawValue);
    }

    let footer = null;
    if (props.setting.validate) {
        const err = props.setting.validate(value).error(intl);
        footer = err ? (
            <FormError
                type={TYPE_BACKSTAGE}
                error={err}
            />
        ) : footer;
    }

    const label = renderLabel(props.setting, props.schema, intl);
    const helpText = renderLDAPSettingHelpText(props.setting, props.schema, Boolean(props.disabled));

    // Show icon if there was a test_value, even if there's no user input (to show effect of default settings)
    // loose equality operator is intentional
    const showFilterIcon = props.filterResult != null &&
        (props.filterResult.test_value !== '' || props.filterResult?.error !== '');

    // Determine icon type and content - three states
    const isFilter = isFilterTest(props.filterResult);
    const isGroupAttribute = isGroupAttributeTest(props.filterResult);
    const countReturned = (isFilter ? props.filterResult?.total_count : props.filterResult?.entries_with_value) || 0;
    const isSuccess = props.filterResult?.error === '' && countReturned > 0;
    const isWarning = props.filterResult?.error === '' && countReturned === 0;

    const getIconClass = () => {
        if (isSuccess) {
            return 'icon icon-check-circle';
        }
        return 'icon icon-alert-outline'; // Used for both warning and failure
    };

    const getIconCssClass = () => {
        if (isSuccess) {
            return 'success';
        }
        if (isWarning) {
            return 'warning';
        }
        return 'error';
    };

    const iconClass = getIconClass();
    const iconCssClass = getIconCssClass();

    const getTooltipContent = () => {
        if (!props.filterResult) {
            return '';
        }

        const totalCount = props.filterResult.total_count || 0;
        const showDefaultDetails = showFilterIcon &&
            (value === '' || props.filterResult.test_name === 'UserFilter' || props.filterResult.test_name === 'GroupFilter');
        const testValue = showDefaultDetails ? props.filterResult.test_value : '';
        const showTestValue = showDefaultDetails;

        if (isSuccess) {
            // If the filter has a testValue, but no userInput, the defaultValue
            // was used. We need to tell the user what that value was.
            let messageKey;
            if (isFilter) {
                messageKey = ldapTestMessages.filterTestSuccess;
            } else if (isGroupAttribute) {
                messageKey = ldapTestMessages.groupAttributeTestSuccess;
            } else {
                messageKey = ldapTestMessages.attributeTestSuccess;
            }
            return intl.formatMessage(messageKey, {countReturned, totalCount, testValue, showTestValue});
        }

        if (isWarning) {
            let messageKey;
            if (isFilter) {
                messageKey = ldapTestMessages.filterTestWarning;
            } else if (isGroupAttribute) {
                messageKey = ldapTestMessages.groupAttributeTestWarning;
            } else {
                messageKey = ldapTestMessages.attributeTestWarning;
            }
            return intl.formatMessage(messageKey, {totalCount, testValue, showTestValue});
        }

        // For failed tests, use translated message with error included
        let messageKey;
        if (isFilter) {
            messageKey = ldapTestMessages.filterTestFailed;
        } else if (isGroupAttribute) {
            messageKey = ldapTestMessages.groupAttributeTestFailed;
        } else {
            messageKey = ldapTestMessages.attributeTestFailed;
        }

        const error = props.filterResult.error || '';
        const showError = Boolean(props.filterResult.error);
        return intl.formatMessage(messageKey, {testValue, showTestValue, error, showError});
    };

    return (
        <div className='ldap-text-setting'>
            <TextSetting
                key={props.schema.id + '_text_' + props.setting.key}
                id={props.setting.key}
                multiple={props.setting.multiple}
                type={inputType}
                label={label}
                helpText={helpText}
                placeholder={props.setting.placeholder}
                value={value}
                disabled={props.disabled}
                setByEnv={props.setByEnv}
                onChange={props.onChange}
                maxLength={props.setting.max_length}
                footer={footer}
            />
            {showFilterIcon && (
                <WithTooltip
                    title={getTooltipContent()}
                    forcedPlacement='top'
                >
                    <i className={`${iconClass} filter-icon ${iconCssClass}`}/>
                </WithTooltip>
            )}
        </div>
    );
};

function sanitizeValue(value: any): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return '';
    }
    return String(value);
}

// Helper functions to determine test type from test result
function isFilterTest(testResult: LdapDiagnosticResult | null) {
    if (!testResult) {
        return false;
    }
    const filterTestNames = new Set(['BaseDN', 'UserFilter', 'GroupFilter', 'GuestFilter', 'AdminFilter']);
    return filterTestNames.has(testResult.test_name);
}

function isGroupAttributeTest(testResult: LdapDiagnosticResult | null) {
    if (!testResult) {
        return false;
    }
    const groupAttributeTestNames = new Set(['GroupDisplayNameAttribute', 'GroupIdAttribute']);
    return groupAttributeTestNames.has(testResult.test_name);
}

const ldapTestMessages = defineMessages({
    filterTestSuccess: {
        id: 'admin.ldap.filterTestSuccess',
        defaultMessage: 'Filter test successful: {countReturned, number} {countReturned, plural, one {result} other {results}} found{showTestValue, select, true {. Value used: {testValue}} other {}}',
    },
    attributeTestSuccess: {
        id: 'admin.ldap.attributeTestSuccess',
        defaultMessage: 'Attribute test successful: {countReturned, number} {countReturned, plural, one {result} other {results}} found out of {totalCount} {totalCount, plural, one {user} other {users}} returned by the user filter',
    },
    filterTestWarning: {
        id: 'admin.ldap.filterTestWarning',
        defaultMessage: 'Filter test successful but no results found. Your filter may be too restrictive.{showTestValue, select, true { Value used: {testValue}} other {}}',
    },
    attributeTestWarning: {
        id: 'admin.ldap.attributeTestWarning',
        defaultMessage: 'The attribute was not found in any of the {totalCount} {totalCount, plural, one {user} other {users}} returned by the user filter',
    },
    filterTestFailed: {
        id: 'admin.ldap.filterTestFailed',
        defaultMessage: 'Filter test failed{showTestValue, select, true {. Value used: {testValue}} other {}}{showError, select, true {: {error}} other {}}',
    },
    attributeTestFailed: {
        id: 'admin.ldap.attributeTestFailed',
        defaultMessage: 'Attribute test failed{showError, select, true {: {error}} other {}}',
    },
    groupAttributeTestSuccess: {
        id: 'admin.ldap.groupAttributeTestSuccess',
        defaultMessage: 'Group attribute test successful: {countReturned, number} {countReturned, plural, one {result} other {results}} found out of {totalCount} {totalCount, plural, one {group} other {groups}} returned by the group filter',
    },
    groupAttributeTestWarning: {
        id: 'admin.ldap.groupAttributeTestWarning',
        defaultMessage: 'The group attribute was not found in any of the {totalCount} {totalCount, plural, one {group} other {groups}} returned by the group filter',
    },
    groupAttributeTestFailed: {
        id: 'admin.ldap.groupAttributeTestFailed',
        defaultMessage: 'Group attribute test failed{showError, select, true {: {error}} other {}}',
    },
});

export default LDAPTextSetting;
