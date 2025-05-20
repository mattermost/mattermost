// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import BooleanSetting from 'components/admin_console/boolean_setting';

import type {GeneralSettingProps} from './ldap_wizard';

import {renderLabel, renderSettingHelpText} from '../schema_admin_settings';

type BoolSettingProps = {
    value: boolean;
    onChange(id: string, value: any): void;
    disabled: boolean;
    setByEnv: boolean;
} & GeneralSettingProps

const LDAPBooleanSetting = (props: BoolSettingProps) => {
    if (!props.schema || !props.setting.key || props.setting.type !== 'bool') {
        return (<></>);
    }

    const label = renderLabel(props.setting, props.schema, props.intl);
    const helpText = renderSettingHelpText(props.setting, props.schema, Boolean(props.disabled));

    return (
        <BooleanSetting
            key={props.schema.id + '_bool_' + props.setting.key}
            id={props.setting.key}
            label={label}
            helpText={helpText}
            value={props.value}
            disabled={props.disabled}
            setByEnv={props.setByEnv}
            onChange={props.onChange}
        />
    );
};

export default LDAPBooleanSetting;
