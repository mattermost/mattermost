// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {FormattedMessage} from 'react-intl';
import {Overlay} from 'react-bootstrap';
import {Link} from 'react-router-dom';

import * as I18n from 'i18n/i18n.jsx';

import Constants from 'utils/constants';
import {rolesFromMapping, mappingValueFromRoles} from 'utils/policy_roles_adapter';
import * as Utils from 'utils/utils';

import RequestButton from 'components/admin_console/request_button/request_button';
import BooleanSetting from 'components/admin_console/boolean_setting';
import TextSetting from 'components/admin_console/text_setting';
import DropdownSetting from 'components/admin_console/dropdown_setting';
import MultiSelectSetting from 'components/admin_console/multiselect_settings';
import RadioSetting from 'components/admin_console/radio_setting';
import ColorSetting from 'components/admin_console/color_setting';
import GeneratedSetting from 'components/admin_console/generated_setting';
import UserAutocompleteSetting from 'components/admin_console/user_autocomplete_setting';
import SettingsGroup from 'components/admin_console/settings_group';
import JobsTable from 'components/admin_console/jobs';
import FileUploadSetting from 'components/admin_console/file_upload_setting.jsx';
import RemoveFileSetting from 'components/admin_console/remove_file_setting';
import SchemaText from 'components/admin_console/schema_text';
import SaveButton from 'components/save_button';
import FormError from 'components/form_error';
import Tooltip from 'components/tooltip';
import WarningIcon from 'components/widgets/icons/fa_warning_icon';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import Setting from './setting';

import './schema_admin_settings.scss';

const emptyList = [];

export default class SchemaAdminSettings extends React.PureComponent {
    static propTypes = {
        config: PropTypes.object,
        environmentConfig: PropTypes.object,
        setNavigationBlocked: PropTypes.func,
        schema: PropTypes.object,
        roles: PropTypes.object,
        license: PropTypes.object,
        editRole: PropTypes.func,
        updateConfig: PropTypes.func.isRequired,
        isDisabled: PropTypes.bool,
        consoleAccess: PropTypes.object,
        cloud: PropTypes.object,
        isCurrentUserSystemAdmin: PropTypes.bool,
    };

    constructor(props) {
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
            errorTooltip: false,
            customComponentWrapperClass: '',
            confirmNeededId: '',
            showConfirmId: '',
            clientWarning: '',
        };
        this.errorMessageRef = React.createRef();
    }

    static getDerivedStateFromProps(props, state) {
        if (props.schema && props.schema.id !== state.prevSchemaId) {
            return {
                prevSchemaId: props.schema.id,
                saveNeeded: false,
                saving: false,
                serverError: null,
                errorTooltip: false,
                ...SchemaAdminSettings.getStateFromConfig(props.config, props.schema, props.roles),
            };
        }
        return null;
    }

    handleSubmit = async (e) => {
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
            const settings = (this.props.schema && this.props.schema.settings) || [];
            const rolesBinding = settings.reduce((acc, val) => {
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

    getConfigFromState(config) {
        const schema = this.props.schema;

        if (schema) {
            let settings = [];

            if (schema.settings) {
                settings = schema.settings;
            } else if (schema.sections) {
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

                if (setting.onConfigSave) {
                    value = setting.onConfigSave(value, previousValue);
                }

                this.setConfigValue(config, setting.key, value);
            });

            if (schema.onConfigSave) {
                return schema.onConfigSave(config, this.props.config);
            }
        }

        return config;
    }

    static getStateFromConfig(config, schema, roles) {
        let state = {};

        if (schema) {
            let settings = [];

            if (schema.settings) {
                settings = schema.settings;
            } else if (schema.sections) {
                schema.sections.map((section) => section.settings).forEach((sectionSettings) => settings.push(...sectionSettings));
            }

            settings.forEach((setting) => {
                if (!setting.key) {
                    return;
                }

                if (setting.type === Constants.SettingsTypes.TYPE_PERMISSION) {
                    try {
                        state[setting.key] = mappingValueFromRoles(setting.permissions_mapping_name, roles) === 'true';
                    } catch (e) {
                        state[setting.key] = false;
                    }
                    return;
                }

                let value = SchemaAdminSettings.getConfigValue(config, setting.key);

                if (setting.onConfigLoad) {
                    value = setting.onConfigLoad(value, config);
                }

                state[setting.key] = value == null ? setting.default : value;
            });

            if (schema.onConfigLoad) {
                state = {...state, ...schema.onConfigLoad(config)};
            }
        }

        return state;
    }

    getSetting(key) {
        for (const setting of this.props.schema.settings) {
            if (setting.key === key) {
                return setting;
            }
        }

        return null;
    }

    getSettingValue(setting) {
        // Force boolean values to false when disabled.
        if (setting.type === Constants.SettingsTypes.TYPE_BOOL) {
            if (this.isDisabled(setting)) {
                return false;
            }
        }
        if (setting.type === Constants.SettingsTypes.TYPE_TEXT && setting.dynamic_value) {
            return setting.dynamic_value(this.state[setting.key], this.props.config, this.state, this.props.license);
        }

        return this.state[setting.key];
    }

    renderTitle = () => {
        if (!this.props.schema) {
            return '';
        }
        if (this.props.schema.translate === false) {
            return (
                <AdminHeader>
                    {this.props.schema.name || this.props.schema.id}
                </AdminHeader>
            );
        }
        return (
            <AdminHeader>
                <FormattedMessage
                    id={this.props.schema.name || this.props.schema.id}
                    defaultMessage={this.props.schema.name_default || this.props.schema.id}
                />
            </AdminHeader>
        );
    };

    renderBanner = (setting) => {
        if (!this.props.schema) {
            return <span>{''}</span>;
        }

        if (setting.label.translate === false) {
            return <span>{setting.label}</span>;
        }

        if (typeof setting.label === 'string') {
            if (setting.label_markdown) {
                return (
                    <FormattedMarkdownMessage
                        id={setting.label}
                        values={setting.label_values}
                        defaultMessage={setting.label_default}
                    />
                );
            }
            return (
                <FormattedMessage
                    id={setting.label}
                    defaultMessage={setting.label_default}
                    values={setting.label_values}
                />
            );
        }
        return setting.label;
    };

    renderHelpText = (setting) => {
        if (!this.props.schema) {
            return <span>{''}</span>;
        }

        if (!setting.help_text) {
            return null;
        }

        let helpText;
        let isMarkdown;
        let helpTextValues;
        let helpTextDefault;
        if (setting.disabled_help_text && this.isDisabled(setting)) {
            helpText = setting.disabled_help_text;
            isMarkdown = setting.disabled_help_text_markdown;
            helpTextValues = setting.disabled_help_text_values;
            helpTextDefault = setting.disabled_help_text_default;
        } else {
            helpText = setting.help_text;
            isMarkdown = setting.help_text_markdown;
            helpTextValues = setting.help_text_values;
            helpTextDefault = setting.help_text_default;
        }

        return (
            <SchemaText
                isMarkdown={isMarkdown}
                isTranslated={setting.translate}
                text={helpText}
                textDefault={helpTextDefault}
                textValues={helpTextValues}
            />
        );
    };

    renderLabel = (setting) => {
        if (!this.props.schema) {
            return '';
        }

        if (setting.translate === false) {
            return setting.label;
        }
        return Utils.localizeMessage(setting.label, setting.label_default);
    };

    isDisabled = (setting) => {
        const enterpriseReady = this.props.config.BuildEnterpriseReady === 'true';
        if (typeof setting.isDisabled === 'function') {
            return setting.isDisabled(this.props.config, this.state, this.props.license, enterpriseReady, this.props.consoleAccess, this.props.cloud, this.props.isCurrentUserSystemAdmin);
        }
        return Boolean(setting.isDisabled);
    };

    isHidden = (setting) => {
        if (typeof setting.isHidden === 'function') {
            return setting.isHidden(this.props.config, this.state, this.props.license);
        }
        return Boolean(setting.isHidden);
    };

    buildButtonSetting = (setting) => {
        const handleRequestAction = (success, error) => {
            if (this.state.saveNeeded !== false) {
                error({message: Utils.localizeMessage('admin_settings.save_unsaved_changes', 'Please save unsaved changes first')});
                return;
            }
            const successCallback = (data) => {
                const metadata = new Map(Object.entries(data));
                const settings = (this.props.schema && this.props.schema.settings) || [];
                settings.forEach((tsetting) => {
                    if (tsetting.key && tsetting.setFromMetadataField) {
                        const inputData = metadata.get(tsetting.setFromMetadataField);

                        if (tsetting.type === Constants.SettingsTypes.TYPE_TEXT) {
                            this.setState({[tsetting.key]: inputData, [`${tsetting.key}Error`]: null});
                        } else if (tsetting.type === Constants.SettingsTypes.TYPE_FILE_UPLOAD) {
                            if (this.buildSettingFunctions[tsetting.type] && this.buildSettingFunctions[tsetting.type](tsetting).props.onSetData) {
                                this.buildSettingFunctions[tsetting.type](tsetting).props.onSetData(tsetting.key, inputData);
                            }
                        }
                    }
                });

                if (success && typeof success === 'function') {
                    success();
                }
            };

            var sourceUrlKey = 'ServiceSettings.SiteURL';
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
                helpText={this.renderHelpText(setting)}
                loadingText={Utils.localizeMessage(setting.loading, setting.loading_default)}
                buttonText={<span>{this.renderLabel(setting)}</span>}
                showSuccessMessage={Boolean(setting.success_message)}
                includeDetailedError={true}
                disabled={this.isDisabled(setting)}
                errorMessage={{
                    id: setting.error_message,
                    defaultMessage: setting.error_message_default,
                }}
                successMessage={setting.success_message && {
                    id: setting.success_message,
                    defaultMessage: setting.success_message_default,
                }}
            />
        );
    };

    buildTextSetting = (setting) => {
        let inputType = 'text';
        if (setting.type === Constants.SettingsTypes.TYPE_NUMBER) {
            inputType = 'number';
        } else if (setting.type === Constants.SettingsTypes.TYPE_LONG_TEXT) {
            inputType = 'textarea';
        }

        let value = '';
        if (setting.dynamic_value) {
            value = setting.dynamic_value(value, this.props.config, this.state, this.props.license);
        } else if (setting.multiple) {
            value = this.state[setting.key] ? this.state[setting.key].join(',') : '';
        } else {
            value = this.state[setting.key] || '';
        }

        let footer = null;
        if (setting.validate) {
            const err = setting.validate(value).error();
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
                helpText={this.renderHelpText(setting)}
                placeholder={Utils.localizeMessage(setting.placeholder, setting.placeholder_default)}
                value={value}
                disabled={this.isDisabled(setting)}
                setByEnv={this.isSetByEnv(setting.key)}
                onChange={this.handleChange}
                maxLength={setting.max_length}
                footer={footer}
            />
        );
    };

    buildColorSetting = (setting) => {
        return (
            <ColorSetting
                key={this.props.schema.id + '_text_' + setting.key}
                id={setting.key}
                label={this.renderLabel(setting)}
                helpText={this.renderHelpText(setting)}
                placeholder={Utils.localizeMessage(setting.placeholder, setting.placeholder_default)}
                value={this.state[setting.key] || ''}
                disabled={this.isDisabled(setting)}
                onChange={this.handleChange}
            />
        );
    };

    buildBoolSetting = (setting) => {
        return (
            <BooleanSetting
                key={this.props.schema.id + '_bool_' + setting.key}
                id={setting.key}
                label={this.renderLabel(setting)}
                helpText={this.renderHelpText(setting)}
                value={this.state[setting.key] || false}
                disabled={this.isDisabled(setting)}
                setByEnv={this.isSetByEnv(setting.key)}
                onChange={this.handleChange}
            />
        );
    };

    buildPermissionSetting = (setting) => {
        return (
            <BooleanSetting
                key={this.props.schema.id + '_bool_' + setting.key}
                id={setting.key}
                label={this.renderLabel(setting)}
                helpText={this.renderHelpText(setting)}
                value={this.state[setting.key] || false}
                disabled={this.isDisabled(setting)}
                setByEnv={this.isSetByEnv(setting.key)}
                onChange={this.handlePermissionChange}
            />
        );
    };

    buildDropdownSetting = (setting) => {
        const enterpriseReady = this.props.config.BuildEnterpriseReady === 'true';
        const options = [];
        setting.options.forEach((option) => {
            if (!option.isHidden || !option.isHidden(this.props.config, this.state, this.props.license, enterpriseReady)) {
                options.push(option);
            }
        });

        const values = options.map((o) => ({value: o.value, text: Utils.localizeMessage(o.display_name, o.display_name_default)}));
        const selectedValue = this.state[setting.key] || values[0].value;

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
                hideHelp = setting.isHelpHidden(this.props.config, this.state, this.props.license, enterpriseReady);
            } else {
                hideHelp = setting.isHelpHidden;
            }
        }

        return (
            <DropdownSetting
                key={this.props.schema.id + '_dropdown_' + setting.key}
                id={setting.key}
                values={values}
                label={this.renderLabel(setting)}
                helpText={hideHelp ? '' : this.renderHelpText(selectedOptionForHelpText || setting)}
                value={selectedValue}
                disabled={this.isDisabled(setting)}
                setByEnv={this.isSetByEnv(setting.key)}
                onChange={this.handleChange}
            />
        );
    };

    buildRolesSetting = (setting) => {
        const {roles} = this.props;

        const values = Object.keys(roles).map((r) => {
            const text = roles[r].display_name ? (
                <FormattedMessage
                    id={roles[r].display_name}
                    defaultMessage={roles[r].name}
                />
            ) : roles[r].name;

            return {
                value: roles[r].name,
                text,
            };
        });

        if (setting.multiple) {
            const noResultText = (
                <FormattedMessage
                    id={setting.no_result}
                    defaultMessage={setting.no_result_default}
                />
            );
            return (
                <MultiSelectSetting
                    key={this.props.schema.id + '_language_' + setting.key}
                    id={setting.key}
                    label={this.renderLabel(setting)}
                    values={values}
                    helpText={this.renderHelpText(setting)}
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
                helpText={this.renderHelpText(setting)}
                value={this.state[setting.key] || values[0].value}
                disabled={this.isDisabled(setting)}
                setByEnv={this.isSetByEnv(setting.key)}
                onChange={this.handleChange}
            />
        );
    };

    buildLanguageSetting = (setting) => {
        const locales = I18n.getAllLanguages();
        const values = Object.keys(locales).map((l) => {
            return {value: locales[l].value, text: locales[l].name, order: locales[l].order};
        }).sort((a, b) => a.order - b.order);

        if (setting.multiple) {
            const noResultText = (
                <FormattedMessage
                    id={setting.no_result}
                    defaultMessage={setting.no_result_default}
                />
            );

            return (
                <MultiSelectSetting
                    key={this.props.schema.id + '_language_' + setting.key}
                    id={setting.key}
                    label={this.renderLabel(setting)}
                    values={values}
                    helpText={this.renderHelpText(setting)}
                    selected={(this.state[setting.key] && this.state[setting.key].split(',')) || []}
                    disabled={this.isDisabled(setting)}
                    setByEnv={this.isSetByEnv(setting.key)}
                    onChange={(changedId, value) => this.handleChange(changedId, value.join(','))}
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
                helpText={this.renderHelpText(setting)}
                value={this.state[setting.key] || values[0].value}
                disabled={this.isDisabled(setting)}
                setByEnv={this.isSetByEnv(setting.key)}
                onChange={this.handleChange}
            />
        );
    };

    buildRadioSetting = (setting) => {
        const options = setting.options || [];
        const values = options.map((o) => ({value: o.value, text: o.display_name}));

        return (
            <RadioSetting
                key={this.props.schema.id + '_radio_' + setting.key}
                id={setting.key}
                values={values}
                label={this.renderLabel(setting)}
                helpText={this.renderHelpText(setting)}
                value={this.state[setting.key] || values[0]}
                disabled={this.isDisabled(setting)}
                setByEnv={this.isSetByEnv(setting.key)}
                onChange={this.handleChange}
            />
        );
    };

    buildBannerSetting = (setting) => {
        if (this.isDisabled(setting)) {
            return null;
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

    buildGeneratedSetting = (setting) => {
        return (
            <GeneratedSetting
                key={this.props.schema.id + '_generated_' + setting.key}
                id={setting.key}
                label={this.renderLabel(setting)}
                helpText={this.renderHelpText(setting)}
                regenerateHelpText={setting.regenerate_help_text}
                placeholder={Utils.localizeMessage(setting.placeholder, setting.placeholder_default)}
                value={this.state[setting.key] || ''}
                disabled={this.isDisabled(setting)}
                setByEnv={this.isSetByEnv(setting.key)}
                onChange={this.handleGeneratedChange}
            />
        );
    };

    handleGeneratedChange = (id, s) => {
        this.handleChange(id, s.replace(/\+/g, '-').replace(/\//g, '_'));
    };

    handleChange = (id, value, confirm = false, doSubmit = false, warning = false) => {
        let saveNeeded = this.state.saveNeeded === 'permissions' ? 'both' : 'config';

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

    handlePermissionChange = (id, value) => {
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

    buildUsernameSetting = (setting) => {
        return (
            <UserAutocompleteSetting
                key={this.props.schema.id + '_userautocomplete_' + setting.key}
                id={setting.key}
                label={this.renderLabel(setting)}
                helpText={this.renderHelpText(setting)}
                placeholder={Utils.localizeMessage(setting.placeholder, setting.placeholder_default) || Utils.localizeMessage('search_bar.search', 'Search')}
                value={this.state[setting.key] || ''}
                disabled={this.isDisabled(setting)}
                onChange={this.handleChange}
            />
        );
    };

    buildJobsTableSetting = (setting) => {
        return (
            <JobsTable
                key={this.props.schema.id + '_jobstable_' + setting.key}
                jobType={setting.job_type}
                getExtraInfoText={setting.render_job}
                disabled={this.isDisabled(setting)}
                createJobButtonText={
                    <FormattedMessage
                        id={setting.label}
                        defaultMessage={setting.label_default}
                    />
                }
                createJobHelpText={
                    <FormattedMarkdownMessage
                        id={setting.help_text}
                        defaultMessage={setting.help_text_default}
                    />
                }
            />
        );
    };

    buildFileUploadSetting = (setting) => {
        const setData = (id, data) => {
            const successCallback = (filename) => {
                this.handleChange(id, filename);
                this.setState({[setting.key]: filename, [`${setting.key}Error`]: null});
            };
            const errorCallback = (error) => {
                this.setState({[setting.key]: null, [`${setting.key}Error`]: error.message});
            };
            setting.set_action(successCallback, errorCallback, data);
        };

        if (this.state[setting.key]) {
            const removeFile = (id, callback) => {
                const successCallback = () => {
                    this.handleChange(setting.key, '');
                    this.setState({[setting.key]: null, [`${setting.key}Error`]: null});
                };
                const errorCallback = (error) => {
                    callback();
                    this.setState({[setting.key]: null, [`${setting.key}Error`]: error.message});
                };
                setting.remove_action(successCallback, errorCallback);
            };
            return (
                <RemoveFileSetting
                    id={this.props.schema.id}
                    key={this.props.schema.id + '_fileupload_' + setting.key}
                    label={this.renderLabel(setting)}
                    helpText={
                        <FormattedMessage
                            id={setting.remove_help_text}
                            defaultMessage={setting.remove_help_text_default}
                        />
                    }
                    removeButtonText={Utils.localizeMessage(setting.remove_button_text, setting.remove_button_text_default)}
                    removingText={Utils.localizeMessage(setting.removing_text, setting.removing_text_default)}
                    fileName={this.state[setting.key]}
                    onSubmit={removeFile}
                    onSetData={setData}
                    disabled={this.isDisabled(setting)}
                    setByEnv={this.isSetByEnv(setting.key)}
                />
            );
        }
        const uploadFile = (id, file, callback) => {
            const successCallback = (filename) => {
                this.handleChange(id, filename);
                this.setState({[setting.key]: filename, [`${setting.key}Error`]: null});
                if (callback && typeof callback === 'function') {
                    callback();
                }
            };
            const errorCallback = (error) => {
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
                helpText={this.renderHelpText(setting)}
                uploadingText={Utils.localizeMessage(setting.uploading_text, setting.uploading_text_default)}
                disabled={this.isDisabled(setting)}
                fileType={setting.fileType}
                onSubmit={uploadFile}
                onSetData={setData}
                error={this.state.idpCertificateFileError}
                setByEnv={this.isSetByEnv(setting.key)}
            />
        );
    };

    buildCustomSetting = (setting) => {
        const CustomComponent = setting.component;

        const componentInstance = (
            <CustomComponent
                key={this.props.schema.id + '_custom_' + setting.key}
                id={setting.key}
                label={this.renderLabel(setting)}
                helpText={this.renderHelpText(setting)}
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
                    helpText={setting.helpText}
                >
                    {componentInstance}
                </Setting>
            );
        }
        return componentInstance;
    };

    unRegisterSaveAction = (saveAction) => {
        const indexOfSaveAction = this.saveActions.indexOf(saveAction);
        this.saveActions.splice(indexOfSaveAction, 1);
    };

    registerSaveAction = (saveAction) => {
        this.saveActions.push(saveAction);
    };

    setSaveNeeded = () => {
        this.setState({saveNeeded: 'config'});
        this.props.setNavigationBlocked(true);
    };

    renderSettings = () => {
        const schema = this.props.schema;

        if (schema.settings) {
            const settingsList = [];
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
                            isTranslated={this.props.schema.translate}
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
                            isTranslated={this.props.schema.translate}
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
        } else if (schema.sections) {
            const sections = [];

            schema.sections.forEach((section) => {
                const settingsList = [];
                if (section.settings) {
                    section.settings.forEach((setting) => {
                        if (this.buildSettingFunctions[setting.type] && !this.isHidden(setting)) {
                            settingsList.push(this.buildSettingFunctions[setting.type](setting));
                        }
                    });
                }

                let header;
                if (section.header) {
                    header = (
                        <div className='banner'>
                            <SchemaText
                                text={section.header}
                                isMarkdown={true}
                                isTranslated={this.props.schema.translate}
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
                                isTranslated={this.props.schema.translate}
                            />
                        </div>
                    );
                }

                sections.push(
                    <div className={'config-section'}>
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

    closeTooltip = () => {
        this.setState({errorTooltip: false});
    };

    openTooltip = (e) => {
        const elm = e.currentTarget.querySelector('.control-label');
        const isElipsis = elm.offsetWidth < elm.scrollWidth;
        this.setState({errorTooltip: isElipsis});
    };

    doSubmit = async (getStateFromConfig) => {
        // clone config so that we aren't modifying data in the stores
        let config = JSON.parse(JSON.stringify(this.props.config));
        config = this.getConfigFromState(config);

        const {error} = await this.props.updateConfig(config);
        if (error) {
            this.setState({
                serverError: error.message,
                serverErrorId: error.id,
            });
        } else {
            this.setState(getStateFromConfig(config));
        }

        if (this.handleSaved) {
            this.handleSaved(config);
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

    // Some path parts may contain periods (e.g. plugin ids), but path walking the configuration
    // relies on splitting by periods. Use this pair of functions to allow such path parts.
    //
    // It is assumed that no path contains the symbol '+'.
    static escapePathPart(pathPart) {
        return pathPart.replace(/\./g, '+');
    }

    static unescapePathPart(pathPart) {
        return pathPart.replace(/\+/g, '.');
    }

    static getConfigValue(config, path) {
        const pathParts = path.split('.');

        return pathParts.reduce((obj, pathPart) => {
            if (!obj) {
                return null;
            }

            return obj[SchemaAdminSettings.unescapePathPart(pathPart)];
        }, config);
    }

    setConfigValue(config, path, value) {
        function setValue(obj, pathParts) {
            const part = SchemaAdminSettings.unescapePathPart(pathParts[0]);

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

    isSetByEnv = (path) => {
        return Boolean(SchemaAdminSettings.getConfigValue(this.props.environmentConfig, path));
    };

    hybridSchemaAndComponent = () => {
        const schema = this.props.schema;
        if (schema && schema.component && schema.settings) {
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
        if (!this.props.schema || !this.props.schema.settings) {
            return true;
        }

        for (const setting of this.props.schema.settings) {
            // Some settings are actually not settings (banner)
            // and don't have a key, skip those ones
            if (!('key' in setting)) {
                continue;
            }

            // don't validate elements set by env.
            if (this.isSetByEnv(setting.key)) {
                continue;
            }

            if (setting.validate) {
                if (setting.isHidden?.(this.props.config)) {
                    // MM-50952
                    // If the setting is hidden, then it is not being set in state so there is
                    // nothing to validate, and validation would fail anyways and prevent saving
                    // In practice, this only happens in custom cloud setup environments like RFQA
                    // where it sets things in the config file directly instead of in the environment
                    // (like cloud Mattermost does)
                    continue;
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
        if (schema && schema.component && !schema.settings) {
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
                        savingMessage={Utils.localizeMessage('admin.saving', 'Saving Config...')}
                    />
                    <div
                        className='error-message'
                        data-testid='errorMessage'
                        ref={this.errorMessageRef}
                        onMouseOver={this.openTooltip}
                        onMouseOut={this.closeTooltip}
                    >
                        <FormError
                            iconClassName='fa-exclamation-triangle'
                            textClassName='has-warning'
                            error={this.state.clientWarning}
                        />

                        <FormError error={this.state.serverError}/>
                    </div>
                    <Overlay
                        show={this.state.errorTooltip}
                        delayShow={Constants.OVERLAY_TIME_DELAY}
                        placement='top'
                        target={this.errorMessageRef.current}
                    >
                        <Tooltip id='error-tooltip' >
                            {this.state.serverError}
                        </Tooltip>
                    </Overlay>
                </div>
            </div>
        );
    };
}
