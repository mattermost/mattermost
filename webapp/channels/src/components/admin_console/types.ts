// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FormatXMLElementFn} from 'intl-messageformat';
import type {
    MessageDescriptor,
    PrimitiveType,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    IntlShape,
} from 'react-intl';

import type {CloudState, Product} from '@mattermost/types/cloud';
import type {AdminConfig, ClientLicense} from '@mattermost/types/config';
import type {JobType} from '@mattermost/types/jobs';

import type Constants from 'utils/constants';

import type ValidationResult from './validation';

type Component = any

type AdminDefinitionConfigSchemaComponent = {
    id: string;
    component: Component;
    isBeta?: boolean;
}

export type ConsoleAccess = {read: {[key: string]: boolean}; write: {[key: string]: boolean}}

type Validator = (value: any) => ValidationResult

type AdminDefinitionSettingCustom = Omit<AdminDefinitionSettingBase, 'label'> & {
    type: 'custom';
    key: string;
    showTitle?: boolean;
    component: Component;
    label?: string | MessageDescriptor;
}

type AdminDefinitionSettingBase = {
    key?: string;
    label: string | MessageDescriptor;
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

type AdminDefinitionSettingRole = AdminDefinitionSettingBase & {
    type: 'roles';
    multiple?: boolean;
    no_result?: string | MessageDescriptor;
}

export type AdminDefinitionSettingInput = AdminDefinitionSettingBase & {
    type: 'text' | 'bool' | 'longtext' | 'number' | 'color';
    placeholder?: string | MessageDescriptor;
    placeholder_values?: {[key: string]: any};
    validate?: Validator;
    multiple?: boolean;
    setFromMetadataField?: string;
    dynamic_value?: (value: any, config: Partial<AdminConfig>, state: any) => string;
    max_length?: number;
    default?: string;
}

type AdminDefinitionSettingGenerated = AdminDefinitionSettingBase & {
    type: 'generated';
    placeholder?: string | MessageDescriptor;
    regenerate_help_text?: string;
    default?: string;
}

export type AdminDefinitionSettingDropdownOption = {
    value: string;
    display_name: string | MessageDescriptor;
    help_text?: string | MessageDescriptor;
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
    remove_help_text: string | MessageDescriptor;
    remove_button_text: string | MessageDescriptor;
    removing_text: string | MessageDescriptor;
    uploading_text: string | MessageDescriptor;
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
    no_result?: string | MessageDescriptor;
}

type AdminDefinitionSettingButton = AdminDefinitionSettingBase & {
    type: 'button';
    action: (success: (data?: any) => void, error: (error: {message: string; detailed_error?: string}) => void, siteUrl: string) => void;
    loading?: string | MessageDescriptor;
    error_message: string | MessageDescriptor;
    success_message?: string | MessageDescriptor;
    sourceUrlKey?: string;
    skipSaveNeeded?: boolean;
}

type AdminDefinitionSettingUsername = AdminDefinitionSettingBase & {
    type: typeof Constants.SettingsTypes.TYPE_USERNAME;
    placeholder: string;
    default?: string;
}

type MappingKeyTypes = 'enableTeamCreation' | 'editOthersPosts' | 'enableOnlyAdminIntegrations';

type AdminDefinitionSettingPermission = AdminDefinitionSettingBase & {
    type: typeof Constants.SettingsTypes.TYPE_PERMISSION;
    permissions_mapping_name: MappingKeyTypes;
    key: string;
}

type AdminDefinitionSettingRadio = AdminDefinitionSettingBase & {
    type: typeof Constants.SettingsTypes.TYPE_RADIO;
    options: AdminDefinitionSettingDropdownOption[];
    default?: string;
}

export type AdminDefinitionSetting = AdminDefinitionSettingCustom |
AdminDefinitionSettingInput | AdminDefinitionSettingGenerated |
AdminDefinitionSettingBanner | AdminDefinitionSettingDropdown |
AdminDefinitionSettingButton | AdminDefinitionSettingFileUpload |
AdminDefinitionSettingJobsTable | AdminDefinitionSettingLanguage |
AdminDefinitionSettingUsername | AdminDefinitionSettingPermission |
AdminDefinitionSettingRadio | AdminDefinitionSettingRole;

type AdminDefinitionConfigSchemaSettings = {
    id: string;
    name: string | MessageDescriptor;
    isBeta?: boolean;
    isHidden?: Check;
    onConfigLoad?: (config: Partial<AdminConfig>) => {[x: string]: string};
    onConfigSave?: (displayVal: any) => any;
    settings?: AdminDefinitionSetting[];
    sections?: AdminDefinitionConfigSchemaSection[];
    footer?: string | MessageDescriptor;
    header?: string | MessageDescriptor;
}

export type AdminDefinitionConfigSchemaSection = {
    key: string;
    title?: string;
    subtitle?: string;
    settings: AdminDefinitionSetting[];
    header?: string | MessageDescriptor;
    footer?: string | MessageDescriptor;
    component?: Component;
    isHidden?: Check;
}

type RestrictedIndicatorType = {
    value: (cloud: CloudState) => JSX.Element;
    shouldDisplay: (license: ClientLicense, subscriptionProduct: Product|undefined) => boolean;
}

export type AdminDefinitionSubSectionSchema = AdminDefinitionConfigSchemaComponent | AdminDefinitionConfigSchemaSettings;

export type AdminDefinitionSubSection = {
    url: string;
    title?: string | MessageDescriptor;
    searchableStrings?: SearchableStrings;
    isHidden?: Check;
    isDiscovery?: boolean;
    isDisabled?: Check;
    schema: AdminDefinitionSubSectionSchema;
    restrictedIndicator?: RestrictedIndicatorType;
}

export type AdminDefinitionSection = {
    icon: JSX.Element;
    sectionTitle: string | MessageDescriptor;
    isHidden: Check;
    id?: string;
    subsections: {[key: string]: AdminDefinitionSubSection};
}

/** From {@link IntlShape.formatMessage}. Cannot discriminate overloaded method signature. */
declare function formatMessageBasic(descriptor: MessageDescriptor, values?: Record<string, PrimitiveType | FormatXMLElementFn<string, string>>): string;

export type SearchableStrings = Array<string | MessageDescriptor | Parameters<typeof formatMessageBasic>>;

export type AdminDefinition = {[key: string]: AdminDefinitionSection}

export type Check = boolean | ((config: Partial<AdminConfig>, state: any, license?: ClientLicense, enterpriseReady?: boolean, consoleAccess?: ConsoleAccess, cloud?: CloudState, isSystemAdmin?: boolean) => boolean)
