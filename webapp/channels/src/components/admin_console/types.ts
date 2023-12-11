// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CloudState, Product} from '@mattermost/types/cloud';
import type {AdminConfig, ClientLicense} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import type ValidationResult from './validation';

type Component = any

type AdminDefinitionConfigSchemaComponent = {
    id: string;
    component: Component;
}

export type ConsoleAccess = {read: {[key: string]: boolean}; write: {[key: string]: boolean}}

type Validator = (value: any) => ValidationResult

type AdminDefinitionSettingCustom = {
    type: 'custom';
    label?: string;
    label_default?: string;
    component: Component;
    key: string;
    isDisabled?: Check;
    isHidden?: Check;
    onConfigSave?: (displayVal: any, previousVal?: any) => any;
}

type AdminDefinitionSettingBase = {
    key?: string;
    label: string;
    label_default: string;
    onConfigLoad?: (configVal: any, config: any) => any;
    onConfigSave?: (displayVal: any, previousVal?: any) => any;
    isHidden?: Check;
    isDisabled?: Check;
}

type AdminDefinitionSettingBanner = AdminDefinitionSettingBase & {
    type: 'banner';
    label_markdown?: boolean;
    label_values?: {[key: string]: any};
    banner_type: 'info' | 'warning';
}

type AdminDefinitionSettingInput = AdminDefinitionSettingBase & {
    type: 'text' | 'bool' | 'longtext' | 'number' | 'color';
    help_text?: string | JSX.Element;
    help_text_default?: string | JSX.Element;
    help_text_markdown?: boolean;
    help_text_values?: {[key: string]: any};
    disabled_help_text?: string;
    disabled_help_text_default?: string;
    disabled_help_text_markdown?: boolean;
    placeholder?: string;
    placeholder_default?: string;
    validate?: Validator;
    setFromMetadataField?: string;
    dynamic_value?: (value: any, config: DeepPartial<AdminConfig>, state: any) => string;
    max_length?: number;
}

type AdminDefinitionSettingGenerated = AdminDefinitionSettingBase & {
    type: 'generated';
    help_text: string | JSX.Element;
    help_text_default: string | JSX.Element;
    isDisabled: Check;
}

type AdminDefinitionSettingDropdownOption = {
    value: string;
    display_name: string;
    display_name_default: string;
    help_text?: string;
    help_text_default?: string;
    help_text_markdown?: boolean;
    help_text_values?: {[key: string]: any};
    isHidden?: Check;
}

type AdminDefinitionSettingDropdown = AdminDefinitionSettingBase & {
    type: 'dropdown';
    help_text?: string | JSX.Element;
    help_text_default?: string | JSX.Element;
    help_text_markdown?: boolean;
    help_text_values?: {[key: string]: any};
    disabled_help_text?: string;
    disabled_help_text_default?: string;
    disabled_help_text_markdown?: boolean;
    options: AdminDefinitionSettingDropdownOption[];
    isHelpHidden?: Check;
}

type AdminDefinitionSettingFileUpload = AdminDefinitionSettingBase & {
    type: 'fileupload';
    help_text: string;
    help_text_default: string;
    remove_help_text: string;
    remove_help_text_default: string;
    remove_button_text: string;
    remove_button_text_default: string;
    removing_text: string;
    removing_text_default: string;
    uploading_text: string;
    uploading_text_default: string;
    fileType: string;
    upload_action: () => void;
    set_action?: () => void;
    setFromMetadataField?: string;
    remove_action: () => void;
}

type AdminDefinitionSettingJobsTable = AdminDefinitionSettingBase & {
    type: 'jobstable';
    job_type: string;
    help_text: string;
    help_text_markdown: boolean;
    help_text_default: string;
    help_text_values?: {[key: string]: any};
    render_job: Component;
};

type AdminDefinitionSettingLanguage = AdminDefinitionSettingBase & {
    type: 'language';
    help_text?: string;
    help_text_markdown?: boolean;
    help_text_default?: string;
    help_text_values?: {[key: string]: any};
    multiple?: boolean;
    no_result?: string;
    no_result_default?: string;
    not_present?: string;
    not_present_default?: string;
}

type AdminDefinitionSettingButton = AdminDefinitionSettingBase & {
    type: 'button';
    action: () => void;
    loading?: string;
    loading_default?: string;
    help_text?: string | JSX.Element;
    help_text_default?: string | JSX.Element;
    help_text_markdown?: boolean;
    help_text_values?: {[key: string]: any};
    error_message: string;
    error_message_default: string;
    success_message?: string;
    success_message_default?: string;
    sourceUrlKey?: string;
}

export type AdminDefinitionSetting = AdminDefinitionSettingCustom |
AdminDefinitionSettingInput | AdminDefinitionSettingGenerated |
AdminDefinitionSettingBanner | AdminDefinitionSettingDropdown |
AdminDefinitionSettingButton | AdminDefinitionSettingFileUpload |
AdminDefinitionSettingJobsTable | AdminDefinitionSettingLanguage;

export type AdminDefinitionConfigSchemaSettings = {
    id: string;
    name: string;
    name_default: string;
    isHidden?: Check;
    onConfigLoad?: (configVal: any, config: any) => any;
    onConfigSave?: (displayVal: any, previousVal?: any) => any;
    settings?: AdminDefinitionSetting[];
    sections?: AdminDefinitionConfigSchemaSection[];
}

type AdminDefinitionConfigSchemaSection = {
    title: string;
    subtitle?: string;
    settings: AdminDefinitionSetting[];
}

type RestrictedIndicatorType = {
    value: (cloud: CloudState) => JSX.Element;
    shouldDisplay: (license: ClientLicense, subscriptionProduct: Product|undefined) => boolean;
}

export type AdminDefinitionSubSection = {
    url: string;
    title?: string;
    title_default?: string;
    searchableStrings?: Array<string|[string, {[key: string]: any}]>;
    isHidden?: Check;
    isDiscovery?: boolean;
    isDisabled?: Check;
    schema: AdminDefinitionConfigSchemaComponent | AdminDefinitionConfigSchemaSettings;
    restrictedIndicator?: RestrictedIndicatorType;
}

export type AdminDefinitionSection = {
    icon: JSX.Element;
    sectionTitle: string;
    sectionTitleDefault: string;
    isHidden: Check;
    id?: string;
    subsections: {[key: string]: AdminDefinitionSubSection};
}

export type AdminDefinition = {[key: string]: AdminDefinitionSection}

export type Check = boolean | ((config: DeepPartial<AdminConfig>, state: any, license?: ClientLicense, enterpriseReady?: boolean, consoleAccess?: ConsoleAccess, cloud?: CloudState, isSystemAdmin?: boolean) => boolean)
