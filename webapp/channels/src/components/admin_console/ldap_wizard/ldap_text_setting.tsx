// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';

import TextSetting from 'components/admin_console/text_setting';
import FormError, {TYPE_BACKSTAGE} from 'components/form_error';

import Constants from 'utils/constants';

import type {GeneralSettingProps} from './ldap_wizard';

import {renderLabel, renderSettingHelpText} from '../schema_admin_settings';

type TextSettingProps = {
    config: Partial<AdminConfig>;
    state: Record<string, unknown>;
    placeholder?: string | MessageDescriptor;
    onChange(id: string, value: any): void;
    disabled: boolean;
    setByEnv: boolean;
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

    let value = '';
    if (props.setting.dynamic_value) {
        value = props.setting.dynamic_value(value, props.config, props.state);
    } else if (props.setting.multiple) {
        value = props.state[props.setting.key] ? (props.state[props.setting.key] as string[]).join(',') : '';
    } else {
        value = (props.state[props.setting.key] as string) ?? (props.setting.default as string || '');
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
    const helpText = renderSettingHelpText(props.setting, props.schema, Boolean(props.disabled));

    return (
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
    );
};

export default LDAPTextSetting;
