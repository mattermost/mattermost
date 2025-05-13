// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import FileUploadSetting from 'components/admin_console/file_upload_setting';
import RemoveFileSetting from 'components/admin_console/remove_file_setting';

import type {GeneralSettingProps} from './ldap_wizard';

import {descriptorOrStringToString, renderLabel, renderSettingHelpText} from '../schema_admin_settings';
import type {AdminDefinitionSettingFileUpload} from '../types';

type Props = {
    setting: AdminDefinitionSettingFileUpload;
    value: string;
    error?: string;
    onChange(id: string, value: any): void;
    fileUploadSetstate: (key: string, filename: string | null, error_message: string | null) => void;
    disabled: boolean;
    setByEnv: boolean;
} & GeneralSettingProps

const LDAPFileUploadSetting = (props: Props) => {
    if (!props.schema || props.setting.type !== 'fileupload' || !props.setting.key) {
        return (<></>);
    }

    if (props.value) {
        const removeFile = (id: string, callback: () => void) => {
            const successCallback = () => {
                props.onChange(id, '');
                props.fileUploadSetstate(props.setting.key!, null, null);
            };
            const errorCallback = (error: any) => {
                callback();
                props.fileUploadSetstate(props.setting.key!, null, error.message);
            };
            props.setting.remove_action(successCallback, errorCallback);
        };

        const label = renderLabel(props.setting, props.schema, props.intl);
        const helpText = renderSettingHelpText(props.setting, props.schema, Boolean(props.disabled));

        return (
            <RemoveFileSetting
                id={props.schema.id}
                key={props.schema.id + '_fileupload_' + props.setting.key}
                label={label}
                helpText={helpText}
                removeButtonText={descriptorOrStringToString(props.setting.remove_button_text, props.intl)}
                removingText={descriptorOrStringToString(props.setting.removing_text, props.intl)}
                fileName={props.value}
                onSubmit={removeFile}
                disabled={props.disabled}
                setByEnv={props.setByEnv}
            />
        );
    }
    const uploadFile = (id: string, file: File, callback: (error?: string) => void) => {
        const successCallback = (filename: string) => {
            props.onChange(id, filename);
            props.fileUploadSetstate(props.setting.key!, filename, null);
            if (callback && typeof callback === 'function') {
                callback();
            }
        };
        const errorCallback = (error: any) => {
            if (callback && typeof callback === 'function') {
                callback(error.message);
            }
        };
        props.setting.upload_action(file, successCallback, errorCallback);
    };

    const label = renderLabel(props.setting, props.schema, props.intl);
    const helpText = renderSettingHelpText(props.setting, props.schema, Boolean(props.disabled));

    return (
        <FileUploadSetting
            id={props.setting.key}
            key={props.schema.id + '_fileupload_' + props.setting.key}
            label={label}
            helpText={helpText}
            uploadingText={descriptorOrStringToString(props.setting.uploading_text, props.intl)}
            disabled={props.disabled}
            fileType={props.setting.fileType}
            onSubmit={uploadFile}
            error={props.error}
        />
    );
};

export default LDAPFileUploadSetting;
