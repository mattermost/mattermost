// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';

import type {CloudState, Product} from '@mattermost/types/cloud';
import type {AdminConfig, ClientLicense} from '@mattermost/types/config';
import type {JobType} from '@mattermost/types/jobs';

import type Constants from 'utils/constants';

import type ValidationResult from './validation';

type Component = any

type AdminDefinitionConfigSchemaComponent = {
    id: string;
    component: Component;
}

export type ConsoleAccess = {read: {[key: string]: boolean}; write: {[key: string]: boolean}}

type Validator = (value: any) => ValidationResult

type AdminDefinitionSettingCustom = Omit<AdminDefinitionSettingBase, 'label'> & {
    type: 'custom';
    key: string;
    showTitle?: boolean;
    component: Component;
    label?: string;
}

type AdminDefinitionSettingBase = {
    key?: string;
    label: MessageDescriptor;
    label_values?: {[key: string]: any};
    help_text?: string | JSX.Element | MessageDescriptor;
    help_text_markdown?: boolean;
    help_text_values?: {[key: string]: any};
    disabled_help_text?: string | JSX.Element | MessageDescriptor;
    disabled_help_text_markdown?: boolean;
    disabled_help_text_values?: {[key: string]: any};
    onConfigLoad?: (configVal: any, config: Partial<AdminConfig>) => any;
    onConfigSave?: (displayVal: any, previousVal?: any) => any;
    isHidden?: Check;
    isDisabled?: Check;
}

export type AdminDefinitionSettingBanner = AdminDefinitionSettingBase & {
    type: 'banner';
    label_markdown?: boolean;
    banner_type: 'info' | 'warning';
}

type AdminDefinitionSettingInput = AdminDefinitionSettingBase & {
    type: 'text' | 'bool' | 'longtext' | 'number' | 'color';
    placeholder?: MessageDescriptor;
    validate?: Validator;
    setFromMetadataField?: string;
    dynamic_value?: (value: any, config: Partial<AdminConfig>, state: any) => string;
    max_length?: number;
}

type AdminDefinitionSettingGenerated = AdminDefinitionSettingBase & {
    type: 'generated';
    placeholder?: string;
    regenerate_help_text?: string;
}

export type AdminDefinitionSettingDropdownOption = {
    value: string;
    display_name: MessageDescriptor;
    help_text?: MessageDescriptor;
    help_text_markdown?: boolean;
    help_text_values?: {[key: string]: any};
    isHidden?: Check;
}

type AdminDefinitionSettingDropdown = AdminDefinitionSettingBase & {
    type: 'dropdown';
    options: AdminDefinitionSettingDropdownOption[];
    isHelpHidden?: Check;
}

type AdminDefinitionSettingFileUpload = AdminDefinitionSettingBase & {
    type: 'fileupload';
    remove_help_text: MessageDescriptor;
    remove_button_text: MessageDescriptor;
    removing_text: MessageDescriptor;
    uploading_text: MessageDescriptor;
    fileType: string;
    upload_action: (file: File, success: (data: any) => void, error: (err: any) => void) => void;
    set_action?: () => void;
    setFromMetadataField?: string;
    remove_action: (success: (data: any) => void, error: (err: any) => void) => void;
}

type AdminDefinitionSettingJobsTable = AdminDefinitionSettingBase & {
    type: 'jobstable';
    job_type: JobType;
    render_job: Component;
};

type AdminDefinitionSettingLanguage = AdminDefinitionSettingBase & {
    type: 'language';
    multiple?: boolean;
    no_result?: MessageDescriptor;
}

type AdminDefinitionSettingButton = AdminDefinitionSettingBase & {
    type: 'button';
    action: (success: (data?: any) => void, error: (error: {message: string; detailed_error?: string}) => void, siteUrl: string) => void;
    loading?: MessageDescriptor;
    error_message: MessageDescriptor;
    success_message?: MessageDescriptor;
    sourceUrlKey?: string;
}

type AdminDefinitionSettingUsername = AdminDefinitionSettingBase & {
    type: typeof Constants.SettingsTypes.TYPE_USERNAME;
    placeholder_message: string;
}

type AdminDefinitionSettingPermission = AdminDefinitionSettingBase & {
    type: typeof Constants.SettingsTypes.TYPE_PERMISSION;
}

type AdminDefinitionSettingRadio = AdminDefinitionSettingBase & {
    type: typeof Constants.SettingsTypes.TYPE_RADIO;
    options: AdminDefinitionSettingDropdownOption[];
}

export type AdminDefinitionSetting = AdminDefinitionSettingCustom |
AdminDefinitionSettingInput | AdminDefinitionSettingGenerated |
AdminDefinitionSettingBanner | AdminDefinitionSettingDropdown |
AdminDefinitionSettingButton | AdminDefinitionSettingFileUpload |
AdminDefinitionSettingJobsTable | AdminDefinitionSettingLanguage |
AdminDefinitionSettingUsername | AdminDefinitionSettingPermission |
AdminDefinitionSettingRadio;

type AdminDefinitionConfigSchemaSettings = {
    id: string;
    name: string | MessageDescriptor;
    isHidden?: Check;
    onConfigLoad?: (config: Partial<AdminConfig>) => {[x: string]: string};
    onConfigSave?: (displayVal: any) => any;
    settings?: AdminDefinitionSetting[];
    sections?: AdminDefinitionConfigSchemaSection[];
    footer?: string;
    header?: string;
}

type AdminDefinitionConfigSchemaSection = {
    title: string;
    subtitle?: string;
    settings: AdminDefinitionSetting[];
    header?: string;
    footer?: string;
}

type RestrictedIndicatorType = {
    value: (cloud: CloudState) => JSX.Element;
    shouldDisplay: (license: ClientLicense, subscriptionProduct: Product|undefined) => boolean;
}

export type AdminDefinitionSubSectionSchema = AdminDefinitionConfigSchemaComponent | AdminDefinitionConfigSchemaSettings;

export type AdminDefinitionSubSection = {
    url: string;
    title?: MessageDescriptor;
    searchableStrings?: Array<string|[string, {[key: string]: any}]>;
    isHidden?: Check;
    isDiscovery?: boolean;
    isDisabled?: Check;
    schema: AdminDefinitionSubSectionSchema;
    restrictedIndicator?: RestrictedIndicatorType;
}

export type AdminDefinitionSection = {
    icon: JSX.Element;
    sectionTitle: MessageDescriptor;
    isHidden: Check;
    id?: string;
    subsections: {[key: string]: AdminDefinitionSubSection};
}

export type AdminDefinition = {[key: string]: AdminDefinitionSection}

export type Check = boolean | ((config: Partial<AdminConfig>, state: any, license?: ClientLicense, enterpriseReady?: boolean, consoleAccess?: ConsoleAccess, cloud?: CloudState, isSystemAdmin?: boolean) => boolean)
