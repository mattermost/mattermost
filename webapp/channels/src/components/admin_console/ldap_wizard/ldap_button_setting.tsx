// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {LdapSettings} from '@mattermost/types/config';

import type {GeneralSettingProps, LDAPDefinitionSettingButton} from './ldap_wizard';

import RequestButton from '../request_button/request_button';
import {descriptorOrStringToString, renderLabel, renderSettingHelpText} from '../schema_admin_settings';

type Props = {
    setting: LDAPDefinitionSettingButton;
    saveNeeded: boolean;
    onChange(id: string, value: any): void;
    disabled: boolean;
    ldapSettingsState: LdapSettings;
} & GeneralSettingProps

const LDAPButtonSetting = (props: Props) => {
    const intl = useIntl();

    if (!props.schema || props.setting.type !== 'button') {
        return null;
    }

    const handleRequestAction = (success: () => void, error: (error: { message: string }) => void) => {
        if (!props.setting.skipSaveNeeded && props.saveNeeded !== false) {
            error({
                message: intl.formatMessage({id: 'admin_settings.save_unsaved_changes', defaultMessage: 'Please save unsaved changes first'}),
            });
            return;
        }
        const successCallback = () => {
            success?.();
        };

        props.setting.action(successCallback, error, props.ldapSettingsState);
    };

    const helpText = renderSettingHelpText(props.setting, props.schema, Boolean(props.disabled));
    const label = renderLabel(props.setting, props.schema, intl);

    return (
        <RequestButton
            id={props.setting.key}
            key={props.schema.id + '_text_' + props.setting.key}
            requestAction={handleRequestAction}
            helpText={helpText}
            loadingText={descriptorOrStringToString(props.setting.loading, intl)}
            buttonText={<span>{label}</span>}
            showSuccessMessage={Boolean(props.setting.success_message)}
            includeDetailedError={true}
            disabled={props.disabled}
            errorMessage={props.setting.error_message}
            successMessage={props.setting.success_message}
        />
    );
};

export default LDAPButtonSetting;
