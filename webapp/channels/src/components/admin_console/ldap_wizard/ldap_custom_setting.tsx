// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {AdminConfig, ClientLicense} from '@mattermost/types/config';

import type {GeneralSettingProps} from './ldap_wizard';

import {renderLabel, renderSettingHelpText} from '../schema_admin_settings';
import Setting from '../setting';

type Props = {
    config: Partial<AdminConfig>;
    license: ClientLicense;
    value?: any;
    registerSaveAction: (saveAction: () => Promise<{error?: {message?: string}}>) => void;
    unRegisterSaveAction: (saveAction: () => Promise<{error?: {message?: string}}>) => void;
    setSaveNeeded: () => void;
    cancelSubmit: () => void;
    showConfirmId: string;
    onChange: (id: string, value: any, confirm: boolean, doSubmit: boolean, warning: boolean) => void;
    disabled: boolean;
    setByEnv: boolean;
} & GeneralSettingProps

const LDAPCustomSetting = (props: Props) => {
    const intl = useIntl();

    if (!props.schema || props.setting.type !== 'custom') {
        return null;
    }

    const label = renderLabel(props.setting, props.schema, intl);
    const helpText = renderSettingHelpText(props.setting, props.schema, Boolean(props.disabled));

    const CustomComponent = props.setting.component;

    const componentInstance = (
        <CustomComponent
            key={props.schema.id + '_custom_' + props.setting.key}
            id={props.setting.key}
            label={label}
            helpText={helpText}
            value={props.value}
            disabled={props.disabled}
            config={props.config}
            license={props.license}
            setByEnv={props.setByEnv}
            onChange={props.onChange}
            registerSaveAction={props.registerSaveAction}
            setSaveNeeded={props.setSaveNeeded}
            unRegisterSaveAction={props.unRegisterSaveAction}
            cancelSubmit={props.cancelSubmit}
            showConfirm={props.showConfirmId === props.setting.key}
        />);

    // Show the plugin custom setting title
    // consistently as other settings with the Setting component
    if (props.setting.showTitle) {
        return (
            <Setting
                label={label}
                inputId={props.setting.key}
                helpText={helpText}
            >
                {componentInstance}
            </Setting>
        );
    }

    return componentInstance;
};

export default LDAPCustomSetting;
