// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {AdminConfig, ClientLicense} from '@mattermost/types/config';

import BooleanSetting from 'components/admin_console/boolean_setting';

import {renderLDAPSettingHelpText} from './ldap_helpers';
import type {GeneralSettingProps} from './ldap_wizard';

import ProductionWarning from '../production_warning';
import {renderLabel} from '../schema_admin_settings';

type BoolSettingProps = {
    value: boolean;
    onChange(id: string, value: any): void;
    disabled: boolean;
    setByEnv: boolean;
    config: Partial<AdminConfig>;
    state: {[x: string]: any};
    license?: ClientLicense;
} & GeneralSettingProps;

const LDAPBooleanSetting = (props: BoolSettingProps) => {
    const intl = useIntl();

    if (!props.schema || !props.setting.key || props.setting.type !== 'bool') {
        return null;
    }

    const label = renderLabel(props.setting, props.schema, intl);
    const helpText = (
        <>
            <ProductionWarning
                setting={props.setting}
                config={props.config}
                state={props.state}
                license={props.license}
                isDisabled={Boolean(props.disabled)}
            />
            {renderLDAPSettingHelpText(props.setting, props.schema, Boolean(props.disabled))}
        </>
    );

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
