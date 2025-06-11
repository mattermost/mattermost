// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {GeneralSettingProps} from './ldap_wizard';

import RequestButton from '../request_button/request_button';
import {descriptorOrStringToString, renderLabel, renderSettingHelpText} from '../schema_admin_settings';
import type {AdminDefinitionSettingButton} from '../types';

type Props = {
    setting: AdminDefinitionSettingButton;
    saveNeeded: boolean;
    onChange(id: string, value: any): void;
    disabled: boolean;
} & GeneralSettingProps

const LDAPButtonSetting = (props: Props) => {
    if (!props.schema || props.setting.type !== 'button') {
        return (<></>);
    }

    const handleRequestAction = (success: () => void, error: (error: { message: string }) => void) => {
        if (!props.setting.skipSaveNeeded && props.saveNeeded !== false) {
            error({
                message: props.intl.formatMessage({id: 'admin_settings.save_unsaved_changes', defaultMessage: 'Please save unsaved changes first'}),
            });
            return;
        }
        const successCallback = () => {
            // NOTE: we don't have any settings with 'setFromMetadataField' in the LDAP wizard
            if (success && typeof success === 'function') {
                success();
            }
        };

        // NOTE: we don't use the sourceUrlKey in the LDAP wizard
        props.setting.action(successCallback, error, '');
    };

    const helpText = renderSettingHelpText(props.setting, props.schema, Boolean(props.disabled));
    const label = renderLabel(props.setting, props.schema, props.intl);

    return (
        <RequestButton
            id={props.setting.key}
            key={props.schema.id + '_text_' + props.setting.key}
            requestAction={handleRequestAction}
            helpText={helpText}
            loadingText={descriptorOrStringToString(props.setting.loading, props.intl)}
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
