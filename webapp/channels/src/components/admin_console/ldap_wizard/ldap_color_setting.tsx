// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import ColorSetting from 'components/admin_console/color_setting';

import {renderLDAPSettingHelpText} from './ldap_helpers';
import type {GeneralSettingProps} from './ldap_wizard';

import {renderLabel} from '../schema_admin_settings';

type ColorSettingProps = {
    value: string;
    onChange(id: string, value: string): void;
    disabled: boolean;
} & GeneralSettingProps;

const LDAPColorSetting = (props: ColorSettingProps) => {
    const intl = useIntl();

    if (!props.schema || !props.setting.key || props.setting.type !== 'color') {
        return null;
    }

    const label = renderLabel(props.setting, props.schema, intl);
    const helpText = renderLDAPSettingHelpText(props.setting, props.schema, Boolean(props.disabled));

    return (
        <ColorSetting
            key={props.schema.id + '_color_' + props.setting.key}
            id={props.setting.key}
            label={label}
            helpText={helpText}
            value={props.value}
            disabled={props.disabled}
            onChange={props.onChange}
        />
    );
};

export default LDAPColorSetting;
