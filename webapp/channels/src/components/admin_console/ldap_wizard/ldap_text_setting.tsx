// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

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
    filterResult?: LdapDiagnosticResult | null;
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

    // Show icon only when input has content and there's a filter result
    const hasContent = value.trim() !== '';
    const showFilterIcon = hasContent && props.filterResult != null; // loose equality operator is intentional

    // Determine icon type and content - three states
    const isSuccess = props.filterResult?.error === '' && (props.filterResult?.total_count || 0) > 0;
    const isWarning = props.filterResult?.error === '' && (props.filterResult?.total_count || 0) === 0;

    const getIconClass = () => {
        if (isSuccess) {
            return 'icon icon-check-circle';
        }
        return 'icon icon-alert-outline'; // Used for both warning and failure
    };

    const getIconCssClass = () => {
        if (isSuccess) {
            return 'ldap-text-setting__filter-icon--success';
        }
        if (isWarning) {
            return 'ldap-text-setting__filter-icon--warning';
        }
        return 'ldap-text-setting__filter-icon--error';
    };

    const iconClass = getIconClass();
    const iconCssClass = getIconCssClass();

    const getTooltipContent = () => {
        if (!props.filterResult) {
            return '';
        }

        if (isSuccess) {
            const count = props.filterResult.total_count || 0;
            return `Test successful: ${count} result${count === 1 ? '' : 's'} found`;
        }

        if (isWarning) {
            return 'Test successful but no results found. Your filter may be too restrictive.';
        }

        // For failed tests, combine message and error if both are available
        const message = props.filterResult.message;
        const error = props.filterResult.error;

        if (message && error) {
            return `${message}: ${error}`;
        }

        return message || error || 'Filter test failed';
    };

    return (
        <div style={{position: 'relative'}}>
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
                    <i className={`${iconClass} ldap-text-setting__filter-icon ${iconCssClass}`}/>
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

export default LDAPTextSetting;
