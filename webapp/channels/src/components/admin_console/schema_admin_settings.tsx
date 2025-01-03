// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape, MessageDescriptor, WrappedComponentProps} from 'react-intl';
import {Link} from 'react-router-dom';

import type {CloudState} from '@mattermost/types/cloud';
import type {AdminConfig, ClientLicense, EnvironmentConfig} from '@mattermost/types/config';
import type {Role} from '@mattermost/types/roles';
import type {DeepPartial} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import BooleanSetting from 'components/admin_console/boolean_setting';
import ColorSetting from 'components/admin_console/color_setting';
import DropdownSetting from 'components/admin_console/dropdown_setting';
import FileUploadSetting from 'components/admin_console/file_upload_setting';
import GeneratedSetting from 'components/admin_console/generated_setting';
import JobsTable from 'components/admin_console/jobs';
import MultiSelectSetting from 'components/admin_console/multiselect_settings';
import RadioSetting from 'components/admin_console/radio_setting';
import RemoveFileSetting from 'components/admin_console/remove_file_setting';
import RequestButton from 'components/admin_console/request_button/request_button';
import SchemaText from 'components/admin_console/schema_text';
import SettingsGroup from 'components/admin_console/settings_group';
import TextSetting from 'components/admin_console/text_setting';
import UserAutocompleteSetting from 'components/admin_console/user_autocomplete_setting';
import FormError from 'components/form_error';
import Markdown from 'components/markdown';
import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import WarningIcon from 'components/widgets/icons/fa_warning_icon';
import WithTooltip from 'components/with_tooltip';

import * as I18n from 'i18n/i18n.jsx';
import Constants from 'utils/constants';
import {mappingValueFromRoles, rolesFromMapping} from 'utils/policy_roles_adapter';

import Setting from './setting';
import type {AdminDefinitionSetting, AdminDefinitionSettingBanner, AdminDefinitionSettingDropdownOption, AdminDefinitionSubSectionSchema, ConsoleAccess} from './types';

import './schema_admin_settings.scss';

const emptyList: string[] = [];

type Props = {
    config: Partial<AdminConfig>;
    environmentConfig: Partial<EnvironmentConfig>;
    setNavigationBlocked: (blocked: boolean) => void;
    schema: AdminDefinitionSubSectionSchema | null;
    roles: Record<string, Role>;
    license: ClientLicense;
    editRole: (role: Role) => void;
    patchConfig: (config: DeepPartial<AdminConfig>) => Promise<ActionResult>;
    isDisabled: boolean;
    consoleAccess: ConsoleAccess;
    cloud: CloudState;
    isCurrentUserSystemAdmin: boolean;
    enterpriseReady: boolean;
} & WrappedComponentProps

type State = {
    [x: string]: any;
    saveNeeded: false | 'both' | 'permissions' | 'config';
    saving: boolean;
    serverError: null;
    customComponentWrapperClass: string;
    confirmNeededId: string;
    showConfirmId: string;
    clientWarning: string;
    prevSchemaId?: string;
}

// Some path parts may contain periods (e.g. plugin ids), but path walking the configuration
// relies on splitting by periods. Use this pair of functions to allow such path parts.
//
// It is assumed that no path contains the symbol '+'.
export function escapePathPart(pathPart: string) {
    return pathPart.replace(/\./g, '+');
}

export function unescapePathPart(pathPart: string) {
    return pathPart.replace(/\+/g, '.');
}

function descriptorOrStringToString(text: string | MessageDescriptor | undefined, intl: IntlShape, values?: {[key: string]: any}): string | undefined {
    if (!text) {
        return undefined;
    }

    return typeof text === 'string' ? text : intl.formatMessage(text, values);
}

export class SchemaAdminSettings extends React.PureComponent<Props, State> {
    private isPlugin: boolean;
    private saveActions: Array<() => Promise<{error?: {message?: string}}>>;
    private buildSettingFunctions: {[x: string]: (setting: any) => JSX.Element};

    constructor(props: Props) {
        super(props);
        this.isPlugin = false;

        this.saveActions = [];

        this.buildSettingFunctions = {
            [Constants.SettingsTypes.TYPE_TEXT]: this.buildTextSetting,
            [Constants.SettingsTypes.TYPE_LONG_TEXT]: this.buildTextSetting,
            [Constants.SettingsTypes.TYPE_NUMBER]: this.buildTextSetting,
            [Constants.SettingsTypes.TYPE_COLOR]: this.buildColorSetting,
            [Constants.SettingsTypes.TYPE_BOOL]: this.buildBoolSetting,
            [Constants.SettingsTypes.TYPE_PERMISSION]: this.buildPermissionSetting,
            [Constants.SettingsTypes.TYPE_DROPDOWN]: this.buildDropdownSetting,
            [Constants.SettingsTypes.TYPE_RADIO]: this.buildRadioSetting,
            [Constants.SettingsTypes.TYPE_BANNER]: this.buildBannerSetting,
            [Constants.SettingsTypes.TYPE_GENERATED]: this.buildGeneratedSetting,
            [Constants.SettingsTypes.TYPE_USERNAME]: this.buildUsernameSetting,
            [Constants.SettingsTypes.TYPE_BUTTON]: this.buildButtonSetting,
            [Constants.SettingsTypes.TYPE_LANGUAGE]: this.buildLanguageSetting,
            [Constants.SettingsTypes.TYPE_JOBSTABLE]: this.buildJobsTableSetting,
            [Constants.SettingsTypes.TYPE_FILE_UPLOAD]: this.buildFileUploadSetting,
            [Constants.SettingsTypes.TYPE_ROLES]: this.buildRolesSetting,
            [Constants.SettingsTypes.TYPE_CUSTOM]: this.buildCustomSetting,
        };
        this.state = {
            saveNeeded: false,
            saving: false,
            serverError: null,
            customComponentWrapperClass: '',
            confirmNeededId: '',
            showConfirmId: '',
            clientWarning: '',
        };
    }

    static getDerivedStateFromProps(props: Props, state: State) {
        if (props.schema && props.schema.id !== state.prevSchemaId) {
            return {
                prevSchemaId: props.schema.id,
                saveNeeded: false,
                saving: false,
                serverError: null,
                ...SchemaAdminSettings.getStateFromConfig(props.config, props.schema, props.roles),
            };
        }
        return null;
    }

    handleSubmit = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (this.state.confirmNeededId) {
            this.setState({
                showConfirmId: this.state.confirmNeededId,
            });
            return;
        }

        this.setState({
            saving: true,
            serverError: null,
        });

        if (this.state.saveNeeded === 'both' || this.state.saveNeeded === 'permissions') {
            const settings = (this.props.schema && 'settings' in this.props.schema && this.props.schema.settings) || [];
            const rolesBinding = settings.reduce<Record<string, string>>((acc, val) => {
                if (val.type === Constants.SettingsTypes.TYPE_PERMISSION) {
                    acc[val.permissions_mapping_name] = this.state[val.key].toString();
                }
                return acc;
            }, {});
            const updatedRoles = rolesFromMapping(rolesBinding, this.props.roles);

            let success = true;

            await Promise.all(Object.values(updatedRoles).map(async (item) => {
                try {
                    await this.props.editRole(item);
                } catch (err) {
                    success = false;
                    this.setState({
                        saving: false,
                        serverError: err.message,
                    });
                }
            }));

            if (!success) {
                return;
            }
        }

        if (this.state.saveNeeded === 'both' || this.state.saveNeeded === 'config') {
            this.doSubmit(SchemaAdminSettings.getStateFromConfig);
        } else {
            this.setState({
                saving: false,
                saveNeeded: false,
                serverError: null,
            });
            this.props.setNavigationBlocked(false);
        }
    };

    getConfigFromState(config: Partial<AdminConfig>) {
        const schema = this.props.schema;

        if (schema) {
            let settings: AdminDefinitionSetting[] = [];

            if ('settings' in schema && schema.settings) {
                settings = schema.settings;
            } else if ('sections' in schema && schema.sections) {
                schema.sections.map((section) => section.settings).forEach((sectionSettings) => settings.push(...sectionSettings));
            }

            settings.forEach((setting) => {
                if (!setting.key) {
                    return;
                }

                if (setting.type === Constants.SettingsTypes.TYPE_PERMISSION) {
                    this.setConfigValue(config, setting.key, null);
                    return;
                }

                let value = this.getSettingValue(setting);
                const previousValue = SchemaAdminSettings.getConfigValue(config, setting.key);

                if ('onConfigSave' in setting && setting.onConfigSave) {
                    value = setting.onConfigSave(value, previousValue);
                }

                this.setConfigValue(config, setting.key, value);
            });

            if ('onConfigSave' in schema && schema.onConfigSave) {
                return schema.onConfigSave(config);
            }
        }

        return config;
    }

    static getStateFromConfig(config: Partial<AdminConfig>, schema: AdminDefinitionSubSectionSchema, roles?: Record<string, Role>) {
        let state: Partial<State> = {};

        if (schema) {
            let settings: AdminDefinitionSetting[] = [];

            if ('settings' in schema && schema.settings) {
                settings = schema.settings;
            } else if ('sections' in schema && schema.sections) {
                schema.sections.map((section) => section.settings).forEach((sectionSettings) => settings.push(...sectionSettings));
            }

            settings.forEach((setting) => {
                if (!setting.key) {
                    return;
                }

                if (setting.type === Constants.SettingsTypes.TYPE_PERMISSION) {
                    try {
                        state[setting.key] = mappingValueFromRoles(setting.permissions_mapping_name, roles!) === 'true';
                    } catch (e) {
                        state[setting.key] = false;
                    }
                    return;
                }

                let value = SchemaAdminSettings.getConfigValue(config, setting.key);

                if ('onConfigLoad' in setting && setting.onConfigLoad) {
                    value = setting.onConfigLoad(value, config);
                }

                state[setting.key] = value == null ? undefined : value;
            });

            if ('onConfigLoad' in schema && schema.onConfigLoad) {
                state = {...state, ...schema.onConfigLoad(config)};
            }
        }

        return state;
    }

    getSetting(key: string) {
        if (!this.props.schema) {
            return null;
        }

        if ('settings' in this.props.schema && this.props.schema.settings) {
            for (const setting of this.props.schema.settings) {
                if (setting.key === key) {
                    return setting;
                }
            }
        }

        return null;
    }

    getSettingValue(setting: AdminDefinitionSetting) {
        // Force boolean values to false when disabled.
        if (setting.type === Constants.SettingsTypes.TYPE_BOOL) {
            if (this.isDisabled(setting)) {
                return false;
            }
        }
        if (!setting.key) {
            return undefined;
        }

        if (setting.type === Constants.SettingsTypes.TYPE_TEXT && setting.dynamic_value) {
            return setting.dynamic_value(this.state[setting.key], this.props.config, this.state);
        }

        return this.state[setting.key];
    }

    renderTitle = () => {
        if (!this.props.schema) {
            return '';
        }

        let name: string | MessageDescriptor = this.props.schema.id;
        if (('name' in this.props.schema)) {
            name = this.props.schema.name;
        }

        if (typeof name === 'string') {
            return (
                <AdminHeader>
                    {name}
                </AdminHeader>
            );
        }

        return (
            <AdminHeader>
                <FormattedMessage
                    {...name}
                />
            </AdminHeader>
        );
    };

    renderBanner = (setting: AdminDefinitionSettingBanner) => {
        if (!this.props.schema || !('label' in setting)) {
            return <span>{''}</span>;
        }

        if (typeof setting.label === 'string') {
            if (setting.label_markdown) {
                return (<Markdown message={setting.label}/>);
            }
            return <span>{setting.label}</span>;
        }

        return (
            <FormattedMessage
                {...setting.label}
                values={setting.label_values}
            />
        );
    };

    renderSettingHelpText = (setting: AdminDefinitionSetting) => {
        if (!this.props.schema || setting.type === 'banner' || !setting.help_text) {
            return <span>{''}</span>;
        }

        let helpText;
        let isMarkdown;
        let helpTextValues;
        if ('disabled_help_text' in setting && setting.disabled_help_text && this.isDisabled(setting)) {
            helpText = setting.disabled_help_text;
            isMarkdown = setting.disabled_help_text_markdown;
            helpTextValues = setting.disabled_help_text_values;
        } else {
            helpText = setting.help_text;
            isMarkdown = setting.help_text_markdown;
            helpTextValues = setting.help_text_values;
        }

        return (
            <SchemaText
                isMarkdown={isMarkdown}
                text={helpText}
                textValues={helpTextValues}
            />
        );
    };

    renderDropdownOptionHelpText = (option: AdminDefinitionSettingDropdownOption) => {
        if (!option.help_text) {
            return <span>{''}</span>;
        }

        return (
            <SchemaText
                isMarkdown={option.help_text_markdown}
                text={option.help_text}
                textValues={option.help_text_values}
            />
        );
    };

    renderLabel = (setting: AdminDefinitionSetting) => {
        if (!this.props.schema || !setting.label) {
            return '';
        }

        if (typeof setting.label === 'string') {
            return setting.label;
        }

        return this.props.intl.formatMessage(setting.label);
    };

    isDisabled = (setting: AdminDefinitionSetting) => {
        if (typeof setting.isDisabled === 'function') {
            return setting.isDisabled(this.props.config, this.state, this.props.license, this.props.enterpriseReady, this.props.consoleAccess, this.props.cloud, this.props.isCurrentUserSystemAdmin);
        }
        return Boolean(setting.isDisabled);
    };

    isHidden = (setting: AdminDefinitionSetting) => {
        if (typeof setting.isHidden === 'function') {
            return setting.isHidden(this.props.config, this.state, this.props.license);
        }
        return Boolean(setting.isHidden);
    };

    buildButtonSetting = (setting: AdminDefinitionSetting) => {
        if (!this.props.schema || setting.type !== 'button') {
            return (<></>);
        }

        const handleRequestAction = (success: () => void, error: (error: {message: string}) => void) => {
            if (!setting.skipSaveNeeded && this.state.saveNeeded !== false) {
                error({
                    message: this.props.intl.formatMessage({id: 'admin_settings.save_unsaved_changes', defaultMessage: 'Please save unsaved changes first'}),
                });
                return;
            }
            const successCallback = (data: any) => {
                const metadata = new Map(Object.entries(data));
                const settings = (this.props.schema && 'settings' in this.props.schema && this.props.schema.settings) || [];
                settings.forEach((tsetting) => {
                    if (tsetting.key && 'setFromMetadataField' in tsetting && tsetting.setFromMetadataField) {
                        const inputData = metadata.get(tsetting.setFromMetadataField);

                        if (tsetting.type === Constants.SettingsTypes.TYPE_TEXT) {
                            this.setState({[tsetting.key]: inputData, [`${tsetting.key}Error`]: null});
                        } else if (tsetting.type === Constants.SettingsTypes.TYPE_FILE_UPLOAD) {
                            if (this.buildSettingFunctions[tsetting.type] && this.buildSettingFunctions[tsetting.type](tsetting)?.props.onSetData) {
                                this.buildSettingFunctions[tsetting.type](tsetting)?.props.onSetData(tsetting.key, inputData);
                            }
                        }
                    }
                });

                if (success && typeof success === 'function') {
                    success();
                }
            };

            let sourceUrlKey = 'ServiceSettings.SiteURL';
            if (setting.sourceUrlKey) {
                sourceUrlKey = setting.sourceUrlKey;
            }

            setting.action(successCallback, error, this.state[sourceUrlKey]);
        };

        return (
            <RequestButton
                id={setting.key}
                key={this.props.schema.id + '_text_' + setting.key}
                requestAction={handleRequestAction}
                helpText={this.renderSettingHelpText(setting)}
                loadingText={descriptorOrStringToString(setting.loading, this.props.intl)}
                buttonText={<span>{this.renderLabel(setting)}</span>}
                showSuccessMessage={Boolean(setting.success_message)}
                includeDetailedError={true}
                disabled={this.isDisabled(setting)}
                errorMessage={setting.error_message}
                successMessage={setting.success_message}
            />
        );
    };

    buildTextSetting = (setting: AdminDefinitionSetting) => {
        if (!this.props.schema || !setting.key || (setting.type !== 'text' && setting.type !== 'longtext' && setting.type !== 'number')) {
            return (<></>);
        }

        let inputType: 'text' | 'number' | 'textarea' = 'text';
        if (setting.type === Constants.SettingsTypes.TYPE_NUMBER) {
            inputType = 'number';
        } else if (setting.type === Constants.SettingsTypes.TYPE_LONG_TEXT) {
            inputType = 'textarea';
        }

        let value = '';
        if (setting.dynamic_value) {
            value = setting.dynamic_value(value, this.props.config, this.state);
        } else if (setting.multiple) {
            value = this.state[setting.key] ? this.state[setting.key].join(',') : '';
        } else {
            value = this.state[setting.key] ?? (setting.default || '');
        }

        let footer = null;
        if (setting.validate) {
            const err = setting.validate(value).error(this.props.intl);
            footer = err ? (
                <FormError
                    type='backstrage'
                    error={err}
                />
            ) : footer;
        }

        return (
            <TextSetting
                key={this.props.schema.id + '_text_' + setting.key}
                id={setting.key}
                multiple={setting.multiple}
                type={inputType}
                label={this.renderLabel(setting)}
                helpText={this.renderSettingHelpText(setting)}
                placeholder={descriptorOrStringToString(setting.placeholder, this.props.intl, setting.placeholder_values)}
                value={value}
                disabled={this.isDisabled(setting)}
                setByEnv={this.isSetByEnv(setting.key)}
                onChange={this.handleChange}
                maxLength={setting.max_length}
                footer={footer}
            />
        );
    };

    buildColorSetting = (setting: AdminDefinitionSetting) => {
        if (!this.props.schema || !setting.key || setting.type !== 'color') {
            return (<></>);
        }
        return (
            <ColorSetting
                key={this.props.schema.id + '_text_' + setting.key}
                id={setting.key}
                label={this.renderLabel(setting)}
                helpText={this.renderSettingHelpText(setting)}
                value={this.state[setting.key] || ''}
                disabled={this.isDisabled(setting)}
                onChange={this.handleChange}
            />
        );
    };

    buildBoolSetting = (setting: AdminDefinitionSetting) => {
        if (!this.props.schema || !setting.key || setting.type !== 'bool') {
            return (<></>);
        }

        return (
            <BooleanSetting
                key={this.props.schema.id + '_bool_' + setting.key}
                id={setting.key}
                label={this.renderLabel(setting)}
                helpText={this.renderSettingHelpText(setting)}
                value={this.state[setting.key] ?? (setting.default || false)}
                disabled={this.isDisabled(setting)}
                setByEnv={this.isSetByEnv(setting.key)}
                onChange={this.handleChange}
            />
        );
    };

    buildPermissionSetting = (setting: AdminDefinitionSetting) => {
        if (!this.props.schema || !setting.key || setting.type !== 'permission') {
            return (<></>);
        }

        return (
            <BooleanSetting
                key={this.props.schema.id + '_bool_' + setting.key}
                id={setting.key}
                label={this.renderLabel(setting)}
                helpText={this.renderSettingHelpText(setting)}
                value={this.state[setting.key] || false}
                disabled={this.isDisabled(setting)}
                setByEnv={this.isSetByEnv(setting.key)}
                onChange={this.handlePermissionChange}
            />
        );
    };

    buildDropdownSetting = (setting: AdminDefinitionSetting) => {
        if (!this.props.schema || !setting.key || setting.type !== 'dropdown') {
            return (<></>);
        }

        const options: AdminDefinitionSettingDropdownOption[] = [];
        setting.options.forEach((option) => {
            if (!option.isHidden || (typeof option.isHidden === 'function' && !option.isHidden(this.props.config, this.state, this.props.license, this.props.enterpriseReady))) {
                options.push(option);
            }
        });

        const values = options.map((o) => ({value: o.value, text: descriptorOrStringToString(o.display_name, this.props.intl)!}));
        const selectedValue = this.state[setting.key] ?? values[0].value;

        let selectedOptionForHelpText = null;
        for (const option of options) {
            if (option.help_text && option.value === selectedValue) {
                selectedOptionForHelpText = option;
                break;
            }
        }

        // used to hide help in case of cloud-starter and open-id selection to show upgrade notice.
        let hideHelp = false;
        if (setting.isHelpHidden) {
            if (typeof (setting.isHelpHidden) === 'function') {
                hideHelp = setting.isHelpHidden(this.props.config, this.state, this.props.license, this.props.enterpriseReady);
            } else {
                hideHelp = setting.isHelpHidden;
            }
        }

        let helpText: string | JSX.Element = '';
        if (!hideHelp) {
            helpText = selectedOptionForHelpText ? this.renderDropdownOptionHelpText(selectedOptionForHelpText) : this.renderSettingHelpText(setting);
        }
        return (
            <DropdownSetting
                key={this.props.schema.id + '_dropdown_' + setting.key}
                id={setting.key}
                values={values}
                label={this.renderLabel(setting)}
                helpText={helpText}
                value={selectedValue}
                disabled={this.isDisabled(setting)}
                setByEnv={this.isSetByEnv(setting.key)}
                onChange={this.handleChange}
            />
        );
    };

    buildRolesSetting = (setting: AdminDefinitionSetting) => {
        if (!this.props.schema || !setting.key || setting.type !== 'roles') {
            return (<></>);
        }
        const {roles} = this.props;

        const values = Object.keys(roles).map((r) => {
            return {
                value: roles[r].name,
                text: roles[r].name,
            };
        });

        if (setting.multiple) {
            const noResultText = typeof setting.no_result === 'object' ? (
                <FormattedMessage {...setting.no_result}/>
            ) : setting.no_result;
            return (
                <MultiSelectSetting
                    key={this.props.schema.id + '_language_' + setting.key}
                    id={setting.key}
                    label={this.renderLabel(setting)}
                    values={values}
                    helpText={this.renderSettingHelpText(setting)}
                    selected={(this.state[setting.key] || emptyList)}
                    disabled={this.isDisabled(setting)}
                    setByEnv={this.isSetByEnv(setting.key)}
                    onChange={this.handleChange}
                    noResultText={noResultText}
                />
            );
        }
        return (
            <DropdownSetting
                key={this.props.schema.id + '_language_' + setting.key}
                id={setting.key}
                label={this.renderLabel(setting)}
                values={values}
                helpText={this.renderSettingHelpText(setting)}
                value={this.state[setting.key] ?? values[0].value}
                disabled={this.isDisabled(setting)}
                setByEnv={this.isSetByEnv(setting.key)}
                onChange={this.handleChange}
            />
        );
    };

    buildLanguageSetting = (setting: AdminDefinitionSetting) => {
        if (!this.props.schema || !setting.key || setting.type !== 'language') {
            return (<></>);
        }
        const locales = I18n.getAllLanguages();
        const values: Array<{value: string; text: string; order: number}> = [];
        for (const l of Object.values(locales)) {
            values.push({value: l.value, text: l.name, order: l.order});
        }
        values.sort((a, b) => a.order - b.order);

        if (setting.multiple) {
            return (
                <MultiSelectSetting
                    key={this.props.schema.id + '_language_' + setting.key}
                    id={setting.key}
                    label={this.renderLabel(setting)}
                    values={values}
                    helpText={this.renderSettingHelpText(setting)}
                    selected={(this.state[setting.key] && this.state[setting.key].split(',')) || []}
                    disabled={this.isDisabled(setting)}
                    setByEnv={this.isSetByEnv(setting.key)}
                    onChange={(changedId, value) => this.handleChange(changedId, value.join(','))}
                    noResultText={descriptorOrStringToString(setting.no_result, this.props.intl)}
                />
            );
        }
        return (
            <DropdownSetting
                key={this.props.schema.id + '_language_' + setting.key}
                id={setting.key}
                label={this.renderLabel(setting)}
                values={values}
                helpText={this.renderSettingHelpText(setting)}
                value={this.state[setting.key] ?? values[0].value}
                disabled={this.isDisabled(setting)}
                setByEnv={this.isSetByEnv(setting.key)}
                onChange={this.handleChange}
            />
        );
    };

    buildRadioSetting = (setting: AdminDefinitionSetting) => {
        if (!this.props.schema || !setting.key || setting.type !== 'radio') {
            return (<></>);
        }

        const options = setting.options || [];
        const values = options.map((o) => ({value: o.value, text: descriptorOrStringToString(o.display_name, this.props.intl)!}));
        const defaultOption = values.find((v) => v.value === setting.default)?.value || values[0].value;

        return (
            <RadioSetting
                key={this.props.schema.id + '_radio_' + setting.key}
                id={setting.key}
                values={values}
                label={this.renderLabel(setting)}
                helpText={this.renderSettingHelpText(setting)}
                value={this.state[setting.key] ?? defaultOption}
                disabled={this.isDisabled(setting)}
                setByEnv={this.isSetByEnv(setting.key)}
                onChange={this.handleChange}
            />
        );
    };

    buildBannerSetting = (setting: AdminDefinitionSetting) => {
        if (!this.props.schema || setting.type !== 'banner' || this.isDisabled(setting)) {
            return (<></>);
        }

        return (
            <div
                className={'banner ' + setting.banner_type}
                key={this.props.schema.id + '_bool_' + setting.key}
            >
                <div className='banner__content'>
                    <span>
                        { setting.banner_type === 'warning' ? <WarningIcon additionalClassName='banner__icon'/> : null}
                        {this.renderBanner(setting)}
                    </span>
                </div>
            </div>
        );
    };

    buildGeneratedSetting = (setting: AdminDefinitionSetting) => {
        if (!this.props.schema || !setting.key || setting.type !== 'generated') {
            return (<></>);
        }

        return (
            <GeneratedSetting
                key={this.props.schema.id + '_generated_' + setting.key}
                id={setting.key}
                label={this.renderLabel(setting)}
                helpText={this.renderSettingHelpText(setting)}
                regenerateHelpText={setting.regenerate_help_text}
                placeholder={descriptorOrStringToString(setting.placeholder, this.props.intl)}
                value={this.state[setting.key] ?? (setting.default || '')}
                disabled={this.isDisabled(setting)}
                setByEnv={this.isSetByEnv(setting.key)}
                onChange={this.handleGeneratedChange}
            />
        );
    };

    handleGeneratedChange = (id: string, s: string) => {
        this.handleChange(id, s.replace(/\+/g, '-').replace(/\//g, '_'));
    };

    handleChange = (id: string, value: any, confirm = false, doSubmit = false, warning = false) => {
        let saveNeeded: State['saveNeeded'] = this.state.saveNeeded === 'permissions' ? 'both' : 'config';

        // Exception: Since OpenId-Custom is treated as feature discovery for Cloud Starter licenses, save button is disabled.
        const isCloudStarter = this.props.license.Cloud === 'true' && this.props.license.SkuShortName === 'starter';
        if (id === 'openidType' && value === 'openid' && isCloudStarter) {
            saveNeeded = false;
        }

        const clientWarning = warning === false ? this.state.clientWarning : warning;

        let confirmNeededId = confirm ? id : this.state.confirmNeededId;
        if (id === this.state.confirmNeededId && !confirm) {
            confirmNeededId = '';
        }

        this.setState({
            saveNeeded,
            confirmNeededId,
            clientWarning,
            [id]: value,
        });

        if (doSubmit) {
            this.doSubmit(SchemaAdminSettings.getStateFromConfig);
        }

        this.props.setNavigationBlocked(true);
    };

    handlePermissionChange = (id: string, value: any) => {
        let saveNeeded = 'permissions';
        if (this.state.saveNeeded === 'config') {
            saveNeeded = 'both';
        }
        this.setState({
            saveNeeded,
            [id]: value,
        });

        this.props.setNavigationBlocked(true);
    };

    buildUsernameSetting = (setting: AdminDefinitionSetting) => {
        if (!this.props.schema || !setting.key || setting.type !== Constants.SettingsTypes.TYPE_USERNAME) {
            return (<></>);
        }

        return (
            <UserAutocompleteSetting
                key={this.props.schema.id + '_userautocomplete_' + setting.key}
                id={setting.key}
                label={this.renderLabel(setting)}
                helpText={this.renderSettingHelpText(setting)}
                placeholder={setting.placeholder}
                value={this.state[setting.key] ?? (setting.default || '')}
                disabled={this.isDisabled(setting)}
                onChange={this.handleChange}
            />
        );
    };

    buildJobsTableSetting = (setting: AdminDefinitionSetting) => {
        if (!this.props.schema || setting.type !== 'jobstable') {
            return (<></>);
        }

        return (
            <JobsTable
                key={this.props.schema.id + '_jobstable_' + setting.key}
                jobType={setting.job_type}
                getExtraInfoText={setting.render_job}
                disabled={this.isDisabled(setting)}
                createJobButtonText={descriptorOrStringToString(setting.label, this.props.intl)}
                createJobHelpText={this.renderSettingHelpText(setting)}
            />
        );
    };

    buildFileUploadSetting = (setting: AdminDefinitionSetting) => {
        if (!this.props.schema || setting.type !== 'fileupload' || !setting.key) {
            return (<></>);
        }

        if (this.state[setting.key]) {
            const removeFile = (id: string, callback: () => void) => {
                const successCallback = () => {
                    this.handleChange(setting.key!, '');
                    this.setState({[setting.key!]: null, [`${setting.key}Error`]: null});
                };
                const errorCallback = (error: any) => {
                    callback();
                    this.setState({[setting.key!]: null, [`${setting.key}Error`]: error.message});
                };
                setting.remove_action(successCallback, errorCallback);
            };
            return (
                <RemoveFileSetting
                    id={this.props.schema.id}
                    key={this.props.schema.id + '_fileupload_' + setting.key}
                    label={this.renderLabel(setting)}
                    helpText={descriptorOrStringToString(setting.remove_help_text, this.props.intl)}
                    removeButtonText={descriptorOrStringToString(setting.remove_button_text, this.props.intl)}
                    removingText={descriptorOrStringToString(setting.removing_text, this.props.intl)}
                    fileName={this.state[setting.key]}
                    onSubmit={removeFile}
                    disabled={this.isDisabled(setting)}
                    setByEnv={this.isSetByEnv(setting.key)}
                />
            );
        }
        const uploadFile = (id: string, file: File, callback: (error?: string) => void) => {
            const successCallback = (filename: string) => {
                this.handleChange(id, filename);
                this.setState({[setting.key!]: filename, [`${setting.key}Error`]: null});
                if (callback && typeof callback === 'function') {
                    callback();
                }
            };
            const errorCallback = (error: any) => {
                if (callback && typeof callback === 'function') {
                    callback(error.message);
                }
            };
            setting.upload_action(file, successCallback, errorCallback);
        };

        return (
            <FileUploadSetting
                id={setting.key}
                key={this.props.schema.id + '_fileupload_' + setting.key}
                label={this.renderLabel(setting)}
                helpText={this.renderSettingHelpText(setting)}
                uploadingText={descriptorOrStringToString(setting.uploading_text, this.props.intl)}
                disabled={this.isDisabled(setting)}
                fileType={setting.fileType}
                onSubmit={uploadFile}
                error={this.state.idpCertificateFileError}
            />
        );
    };

    buildCustomSetting = (setting: AdminDefinitionSetting) => {
        if (!this.props.schema || !(setting.type === 'custom')) {
            return (<></>);
        }

        const CustomComponent = setting.component;

        const componentInstance = (
            <CustomComponent
                key={this.props.schema.id + '_custom_' + setting.key}
                id={setting.key}
                label={this.renderLabel(setting)}
                helpText={this.renderSettingHelpText(setting)}
                value={this.state[setting.key]}
                disabled={this.isDisabled(setting)}
                config={this.props.config}
                license={this.props.license}
                setByEnv={this.isSetByEnv(setting.key)}
                onChange={this.handleChange}
                registerSaveAction={this.registerSaveAction}
                setSaveNeeded={this.setSaveNeeded}
                unRegisterSaveAction={this.unRegisterSaveAction}
                cancelSubmit={this.cancelSubmit}
                showConfirm={this.state.showConfirmId === setting.key}
            />);

        // Show the plugin custom setting title
        // consistently as other settings with the Setting component
        if (setting.showTitle) {
            return (
                <Setting
                    label={setting.label}
                    inputId={setting.key}
                    helpText={setting.help_text}
                >
                    {componentInstance}
                </Setting>
            );
        }
        return componentInstance;
    };

    unRegisterSaveAction = (saveAction: () => Promise<{error?: {message?: string}}>) => {
        const indexOfSaveAction = this.saveActions.indexOf(saveAction);
        this.saveActions.splice(indexOfSaveAction, 1);
    };

    registerSaveAction = (saveAction: () => Promise<{error?: {message?: string}}>) => {
        this.saveActions.push(saveAction);
    };

    setSaveNeeded = () => {
        this.setState({saveNeeded: 'config'});
        this.props.setNavigationBlocked(true);
    };

    renderSettings = () => {
        const schema = this.props.schema;
        if (!schema) {
            return null;
        }

        if ('settings' in schema && schema.settings) {
            const settingsList: React.ReactNode[] = [];
            if (schema.settings) {
                schema.settings.forEach((setting) => {
                    if (this.buildSettingFunctions[setting.type] && !this.isHidden(setting)) {
                        settingsList.push(this.buildSettingFunctions[setting.type](setting));
                    }
                });
            }

            let header;
            if (schema.header) {
                header = (
                    <div className='banner'>
                        <SchemaText
                            text={schema.header}
                            isMarkdown={true}
                        />
                    </div>
                );
            }

            let footer;
            if (schema.footer) {
                footer = (
                    <div className='banner'>
                        <SchemaText
                            text={schema.footer}
                            isMarkdown={true}
                        />
                    </div>
                );
            }

            return (
                <SettingsGroup container={false}>
                    {header}
                    {settingsList}
                    {footer}
                </SettingsGroup>
            );
        } else if ('sections' in schema && schema.sections) {
            const sections: React.ReactNode[] = [];

            schema.sections.forEach((section) => {
                const settingsList: React.ReactNode[] = [];
                if (section.settings) {
                    section.settings.forEach((setting) => {
                        if (this.buildSettingFunctions[setting.type] && !this.isHidden(setting)) {
                            settingsList.push(this.buildSettingFunctions[setting.type](setting));
                        }
                    });
                }

                if (section.component) {
                    const CustomComponent = section.component;
                    sections.push((
                        <CustomComponent
                            settingsList={settingsList}
                            key={section.key}
                        />
                    ));
                    return;
                }

                let header;
                if (section.header) {
                    header = (
                        <div className='banner'>
                            <SchemaText
                                text={section.header}
                                isMarkdown={true}
                            />
                        </div>
                    );
                }

                let footer;
                if (section.footer) {
                    footer = (
                        <div className='banner'>
                            <SchemaText
                                text={section.footer}
                                isMarkdown={true}
                            />
                        </div>
                    );
                }

                // This is a bit of special case since designs for plugin config expect the Enable/Disable setting
                // to be on top and out of the sections.
                if (section.key.startsWith('PluginSettings.PluginStates') && section.key.endsWith('Enable.Section')) {
                    sections.push(
                        <SettingsGroup
                            container={false}
                            key={section.key}
                        >
                            {header}
                            {settingsList}
                            {footer}
                        </SettingsGroup>,
                    );

                    return;
                }

                sections.push(
                    <div
                        className={'config-section'}
                        key={section.key}
                    >
                        <SettingsGroup
                            show={true}
                            title={section.title}
                            subtitle={section.subtitle}
                        >
                            <div className={'section-body'}>
                                {header}
                                {settingsList}
                                {footer}
                            </div>
                        </SettingsGroup>
                    </div>,
                );
            });

            return (
                <div>
                    {sections}
                </div>
            );
        }

        return null;
    };

    doSubmit = async (getStateFromConfig: (config: Partial<AdminConfig>, schema: AdminDefinitionSubSectionSchema, roles?: Record<string, Role>) => Partial<State>) => {
        if (!this.props.schema) {
            return;
        }

        // clone config so that we aren't modifying data in the stores
        let config = JSON.parse(JSON.stringify(this.props.config));
        config = this.getConfigFromState(config);

        const {error} = await this.props.patchConfig(config);
        if (error) {
            this.setState({
                serverError: error.message,
                serverErrorId: error.id,
            });
        } else {
            this.setState(getStateFromConfig(config, this.props.schema));
        }

        const results = [];
        for (const saveAction of this.saveActions) {
            results.push(saveAction());
        }

        const hasSaveActionError = await Promise.all(results).then((values) => values.some(((value) => value.error && value.error.message)));

        const hasError = this.state.serverError || hasSaveActionError;
        if (hasError) {
            this.setState({saving: false});
        } else {
            this.setState({saving: false, saveNeeded: false, confirmNeededId: '', showConfirmId: '', clientWarning: ''});
            this.props.setNavigationBlocked(false);
        }
    };

    cancelSubmit = () => {
        this.setState({
            showConfirmId: '',
        });
    };

    static getConfigValue(config: any, path: string) {
        const pathParts = path.split('.');

        return pathParts.reduce((obj, pathPart) => {
            if (!obj) {
                return null;
            }

            return obj[unescapePathPart(pathPart)];
        }, config);
    }

    setConfigValue(config: any, path: string, value: any) {
        function setValue(obj: any, pathParts: string[]) {
            const part = unescapePathPart(pathParts[0]);

            if (pathParts.length === 1) {
                obj[part] = value;
            } else {
                if (obj[part] == null) {
                    obj[part] = {};
                }

                setValue(obj[part], pathParts.slice(1));
            }
        }

        setValue(config, path.split('.'));
    }

    isSetByEnv = (path: string) => {
        return Boolean(SchemaAdminSettings.getConfigValue(this.props.environmentConfig, path));
    };

    hybridSchemaAndComponent = () => {
        const schema = this.props.schema;
        if (schema && 'component' in schema && schema.component) {
            const CustomComponent = schema.component;
            return (
                <CustomComponent
                    {...this.props}
                    disabled={this.props.isDisabled}
                />
            );
        }
        return null;
    };

    canSave = () => {
        if (!this.props.schema || !('settings' in this.props.schema) || !this.props.schema.settings) {
            return true;
        }

        for (const setting of this.props.schema.settings) {
            // Some settings are actually not settings (banner)
            // and don't have a key, skip those ones
            if (!('key' in setting) || !setting.key) {
                continue;
            }

            // don't validate elements set by env.
            if (this.isSetByEnv(setting.key)) {
                continue;
            }

            if ('validate' in setting && setting.validate) {
                if ('isHidden' in setting) {
                    let hidden = false;
                    if (typeof setting.isHidden === 'function') {
                        hidden = setting.isHidden?.(this.props.config, this.state, this.props.license, this.props.enterpriseReady, this.props.consoleAccess, this.props.cloud, this.props.isCurrentUserSystemAdmin);
                    } else {
                        hidden = Boolean(setting.isHidden);
                    }

                    // MM-50952
                    // If the setting is hidden, then it is not being set in state so there is
                    // nothing to validate, and validation would fail anyways and prevent saving
                    // In practice, this only happens in custom cloud setup environments like RFQA
                    // where it sets things in the config file directly instead of in the environment
                    // (like cloud Mattermost does)
                    if (hidden) {
                        continue;
                    }
                }
                const result = setting.validate(this.state[setting.key]);
                if (!result.isValid()) {
                    return false;
                }
            }
        }

        return true;
    };

    render = () => {
        const schema = this.props.schema;
        if (schema && 'component' in schema && schema.component && (!('settings' in schema))) {
            const CustomComponent = schema.component;
            return (
                <CustomComponent
                    {...this.props}
                    disabled={this.props.isDisabled}
                />
            );
        }

        if (!schema) {
            return (
                <div className={'wrapper--fixed'}>
                    <AdminHeader>
                        <FormattedMessage
                            id='error.plugin_not_found.title'
                            defaultMessage='Plugin Not Found'
                        />
                    </AdminHeader>
                    <div className='admin-console__wrapper'>
                        <div className='admin-console__content'>
                            <p>
                                <FormattedMessage
                                    id='error.plugin_not_found.desc'
                                    defaultMessage='The plugin you are looking for does not exist.'
                                />
                            </p>
                            <Link
                                to={'plugin_management'}
                            >
                                <FormattedMessage
                                    id='admin.plugin.backToPlugins'
                                    defaultMessage='Go back to the Plugins'
                                />
                            </Link>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className={'wrapper--fixed ' + this.state.customComponentWrapperClass}>
                {this.renderTitle()}
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <form
                            className='form-horizontal'
                            role='form'
                            onSubmit={this.handleSubmit}
                        >
                            {this.renderSettings()}
                        </form>
                        {this.hybridSchemaAndComponent()}
                    </div>
                </div>
                <div className='admin-console-save'>
                    <SaveButton
                        saving={this.state.saving}
                        disabled={!this.state.saveNeeded || (this.canSave && !this.canSave())}
                        onClick={this.handleSubmit}
                        savingMessage={this.props.intl.formatMessage({id: 'admin.saving', defaultMessage: 'Saving Config...'})}
                    />
                    <WithTooltip
                        title={this.state?.serverError ?? ''}
                    >
                        <div
                            className='error-message'
                            data-testid='errorMessage'
                        >
                            <FormError
                                iconClassName='fa-exclamation-triangle'
                                textClassName='has-warning'
                                error={this.state.clientWarning}
                            />

                            <FormError error={this.state.serverError}/>
                        </div>
                    </WithTooltip>
                </div>
            </div>
        );
    };
}

export default injectIntl(SchemaAdminSettings);
