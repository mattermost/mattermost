// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {AdminConfig, ClientLicense} from '@mattermost/types/config';

import DropdownSetting from 'components/admin_console/dropdown_setting';

import type {GeneralSettingProps} from './ldap_wizard';

import {descriptorOrStringToString, renderDropdownOptionHelpText, renderLabel, renderSettingHelpText} from '../schema_admin_settings';
import type {AdminDefinitionSettingDropdownOption} from '../types';

type Props = {
    config: Partial<AdminConfig>;
    state: Record<string, unknown>;
    license: ClientLicense;
    enterpriseReady: boolean;
    onChange(id: string, value: any): void;
    disabled: boolean;
    setByEnv: boolean;
} & GeneralSettingProps

const LDAPDropdownSetting = (props: Props) => {
    const intl = useIntl();

    if (!props.schema || !props.setting.key || props.setting.type !== 'dropdown') {
        return null;
    }

    const options: AdminDefinitionSettingDropdownOption[] = [];
    props.setting.options.forEach((option) => {
        if (!option.isHidden || (typeof option.isHidden === 'function' &&
            !option.isHidden(props.config, props.state, props.license, props.enterpriseReady))) {
            options.push(option);
        }
    });

    const values = options.map((o) => ({value: o.value, text: descriptorOrStringToString(o.display_name, intl)!}));
    const selectedValue = (props.state[props.setting.key] as string) ?? values[0].value;

    let selectedOptionForHelpText = null;
    for (const option of options) {
        if (option.help_text && option.value === selectedValue) {
            selectedOptionForHelpText = option;
            break;
        }
    }

    // used to hide help in case of cloud-starter and open-id selection to show upgrade notice.
    let hideHelp = false;
    if (props.setting.isHelpHidden) {
        if (typeof (props.setting.isHelpHidden) === 'function') {
            hideHelp = props.setting.isHelpHidden(props.config, props.state, props.license, props.enterpriseReady);
        } else {
            hideHelp = props.setting.isHelpHidden;
        }
    }

    const label = renderLabel(props.setting, props.schema, intl);

    let helpText: string | JSX.Element = '';
    if (!hideHelp) {
        helpText = selectedOptionForHelpText ? renderDropdownOptionHelpText(selectedOptionForHelpText) : renderSettingHelpText(props.setting, props.schema, Boolean(props.disabled));
    }
    return (
        <DropdownSetting
            key={props.schema.id + '_dropdown_' + props.setting.key}
            id={props.setting.key}
            values={values}
            label={label}
            helpText={helpText}
            value={selectedValue}
            disabled={props.disabled}
            setByEnv={props.setByEnv}
            onChange={props.onChange}
        />
    );
};

export default LDAPDropdownSetting;
