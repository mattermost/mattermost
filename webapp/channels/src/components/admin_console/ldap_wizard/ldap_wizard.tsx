// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState, useMemo} from 'react';
import type {MessageDescriptor, WrappedComponentProps} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import type {TestLdapFiltersResponse} from '@mattermost/types/admin';
import type {CloudState} from '@mattermost/types/cloud';
import type {AdminConfig, ClientLicense, EnvironmentConfig} from '@mattermost/types/config';
import type {Role} from '@mattermost/types/roles';
import type {DeepPartial} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import SettingsGroup from 'components/admin_console/settings_group';
import {useSectionNavigation} from 'components/common/hooks/useSectionNavigation';
import FormError from 'components/form_error';
import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import WithTooltip from 'components/with_tooltip';

import Constants from 'utils/constants';

import LDAPBooleanSetting from './ldap_boolean_setting';
import LDAPButtonSetting from './ldap_button_setting';
import LDAPCustomSetting from './ldap_custom_setting';
import LDAPDropdownSetting from './ldap_dropdown_setting';
import LDAPExpandableSetting from './ldap_expandable_setting';
import LDAPFileUploadSetting from './ldap_file_upload_setting';
import LDAPJobsTableSetting from './ldap_jobs_table_setting';
import LDAPTextSetting from './ldap_text_setting';

import {ldapWizardAdminDefinition} from '../admin_definition_ldap_wizard';
import {getConfigFromState, isSetByEnv, SchemaAdminSettings} from '../schema_admin_settings';
import SchemaText from '../schema_text';
import type {AdminDefinitionConfigSchemaSection, AdminDefinitionSetting, AdminDefinitionSettingButton, AdminDefinitionSettingFileUpload, AdminDefinitionSubSectionSchema, ConsoleAccess} from '../types';
import './ldap_wizard.scss';

const SECTION_OBSERVER_OPTIONS: IntersectionObserverInit = {
    root: null, // Use viewport as root
    rootMargin: '-40% 0px -40% 0px', // Active when in the middle 20% of the viewport
    threshold: 0.01, // At least 1% of element in this zone
};

export type LDAPDefinitionSettingButton = AdminDefinitionSettingButton & {
    action: (success: () => void, error: (error: { message: string }) => void, settings?: Record<string, any>) => void;
}

export type LDAPDefinitionSetting = AdminDefinitionSetting & {
    help_text_more_info?: string | JSX.Element | MessageDescriptor;
}

export type LDAPAdminDefinitionConfigSchemaSettings = AdminDefinitionSubSectionSchema & {
    sections?: LDAPAdminDefinitionConfigSchemaSection[];
}

export type LDAPAdminDefinitionConfigSchemaSection = Omit<AdminDefinitionConfigSchemaSection, 'settings'> & {
    sectionTitle?: string;
    settings: LDAPDefinitionSetting[];
}

export type GeneralSettingProps = {
    setting: LDAPDefinitionSetting;
    schema: AdminDefinitionSubSectionSchema | null;
}

type Props = {
    config: Partial<AdminConfig>;
    environmentConfig: Partial<EnvironmentConfig>;
    setNavigationBlocked: (blocked: boolean) => void;
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
    [x: string]: unknown;
    saveNeeded: false | 'both' | 'permissions' | 'config';
    saving: boolean;
    serverError: string | null;
    confirmNeededId: string;
    showConfirmId: string;
    clientWarning: string | boolean;
    prevSchemaId?: string;
}

const LDAPWizard = (props: Props) => {
    const schema = ldapWizardAdminDefinition;

    const [state, setState] = useState<State>({
        saveNeeded: false,
        saving: false,
        serverError: null,
        confirmNeededId: '',
        showConfirmId: '',
        clientWarning: '',
    });

    React.useEffect(() => {
        if (props.config && schema) {
            const initialStateFromConfig = SchemaAdminSettings.getStateFromConfig(props.config, schema, props.roles);
            setState((prevState) => ({
                ...prevState,
                ...initialStateFromConfig,
                prevSchemaId: schema.id,
            }));
        }
    }, [props.config, props.roles, schema]);

    const [saveActions, setSaveActions] = useState<Array<() => Promise<{ error?: { message?: string } }>>>([]);

    // Combined test results - both filter and attribute test results in one array
    const [testResults, setTestResults] = useState<TestLdapFiltersResponse | null>(null);

    const getTestResult = useCallback((settingKey: string) => {
        const testName = settingKeyToTestNameMap[settingKey];
        if (!testName || !testResults) {
            return null;
        }

        return testResults.find((result) => result.test_name === testName) || null;
    }, [testResults]);

    const handleTestResults = useCallback((results: TestLdapFiltersResponse, testType: 'filter' | 'attribute' | 'groupAttribute') => {
        const filteredResults = results.filter((result) => result.test_value !== '' || result?.error !== '');

        setTestResults((prevResults) => {
            // Object lookup for test type functions - cleaner than a switch statement
            const testTypeFunctions = {
                filter: isFilterTestName,
                attribute: isAttributeTestName,
                groupAttribute: isGroupAttributeTestName,
            } as const;

            const isCurrentTestType = testTypeFunctions[testType] || (() => false);

            // Keep existing results from other test types, replace results from current test type
            const existingResultsFromOtherTypes = prevResults ? prevResults.filter((result) => !isCurrentTestType(result.test_name)) : [];

            // Combine with new results
            return [...existingResultsFromOtherTypes, ...filteredResults];
        });
    }, []);

    const memoizedSections = useMemo(() => {
        return (schema && 'sections' in schema && schema.sections) ? schema.sections : [];
    }, [schema]);
    const memoizedSectionKeys = useMemo(() => {
        return memoizedSections.map((section) => section.key);
    }, [memoizedSections]);

    const {activeSectionKey, sectionRefs} = useSectionNavigation(memoizedSectionKeys, SECTION_OBSERVER_OPTIONS);

    const buildTextSetting = (setting: AdminDefinitionSetting) => {
        const testResult = getTestResult(setting.key || '');
        return (
            <LDAPTextSetting
                config={props.config}
                key={schema.id + '_text_' + setting.key}
                state={state}
                onChange={handleChange}
                schema={schema}
                disabled={isDisabled(setting)}
                setByEnv={isSetByEnv(setting.key!, props.environmentConfig)}
                setting={setting}
                filterResult={testResult}
            />
        );
    };

    const buildBoolSetting = (setting: AdminDefinitionSetting) => {
        return (
            <LDAPBooleanSetting
                key={schema.id + '_bool_' + setting.key}
                value={state[setting.key!] as boolean || false}
                onChange={handleChange}
                schema={schema}
                disabled={isDisabled(setting)}
                setByEnv={isSetByEnv(setting.key!, props.environmentConfig)}
                setting={setting}
            />
        );
    };

    const buildDropdownSetting = (setting: AdminDefinitionSetting) => {
        return (
            <LDAPDropdownSetting
                config={props.config}
                license={props.license}
                enterpriseReady={props.enterpriseReady}
                key={schema.id + '_dropdown_' + setting.key}
                state={state}
                onChange={handleChange}
                schema={schema}
                disabled={isDisabled(setting)}
                setByEnv={isSetByEnv(setting.key!, props.environmentConfig)}
                setting={setting}
            />
        );
    };

    const buildButtonSetting = (setting: AdminDefinitionSetting | LDAPDefinitionSettingButton) => {
        let config = JSON.parse(JSON.stringify(props.config));
        config = getConfigFromState(config, state, schema, isDisabled);
        var testResultsHandler;
        if (setting.key === 'LdapSettings.TestFilters') {
            testResultsHandler = (results: TestLdapFiltersResponse) => handleTestResults(results, 'filter');
        } else if (setting.key === 'LdapSettings.TestAttributes') {
            testResultsHandler = (results: TestLdapFiltersResponse) => handleTestResults(results, 'attribute');
        } else if (setting.key === 'LdapSettings.TestGroupAttributes') {
            testResultsHandler = (results: TestLdapFiltersResponse) => handleTestResults(results, 'groupAttribute');
        }

        return (
            <LDAPButtonSetting
                key={schema.id + '_button_' + setting.key}
                onChange={handleChange}
                saveNeeded={false}
                schema={schema}
                disabled={isDisabled(setting)}
                setting={setting as LDAPDefinitionSettingButton}
                ldapSettingsState={config.LdapSettings}
                onFilterTestResults={testResultsHandler}
            />
        );
    };

    const buildJobsTableSetting = (setting: AdminDefinitionSetting) => {
        return (
            <LDAPJobsTableSetting
                key={schema.id + '_jobstable_' + setting.key}
                schema={schema}
                disabled={isDisabled(setting)}
                setting={setting}
            />
        );
    };

    const fileUploadSetstate = (key: string, filename: string | null, errorMessage: string | null) => {
        setState((prev) => ({
            ...prev,
            [key]: filename,
            [key + 'Error']: errorMessage,
        }));
    };

    const buildFileUploadSetting = (setting: AdminDefinitionSetting) => {
        return (
            <LDAPFileUploadSetting
                key={schema.id + '_fileupload_' + setting.key}
                value={state[setting.key!] as string}
                onChange={handleChange}
                fileUploadSetstate={fileUploadSetstate}
                schema={schema}
                disabled={isDisabled(setting)}
                setByEnv={isSetByEnv(setting.key!, props.environmentConfig)}
                setting={setting as AdminDefinitionSettingFileUpload}
            />
        );
    };

    const buildCustomSetting = (setting: AdminDefinitionSetting) => {
        return (
            <LDAPCustomSetting
                config={props.config}
                license={props.license}
                key={schema.id + '_custom_' + setting.key}
                schema={schema}
                setting={setting}
                value={state[setting.key!]}
                disabled={isDisabled(setting)}
                setByEnv={isSetByEnv(setting.key!, props.environmentConfig)}
                onChange={handleChange}
                registerSaveAction={registerSaveAction}
                setSaveNeeded={setSaveNeeded}
                unRegisterSaveAction={unRegisterSaveAction}
                cancelSubmit={cancelSubmit}
                showConfirmId={state.showConfirmId}
            />
        );
    };

    const buildExpandableSetting = (setting: AdminDefinitionSetting) => {
        return (
            <LDAPExpandableSetting
                key={schema.id + '_expandable_' + setting.key}
                schema={schema}
                setting={setting}
                buildSettingFunction={(subSetting: LDAPDefinitionSetting) => {
                    if (buildSettingFunctions[subSetting.type] && !isHidden(subSetting as AdminDefinitionSetting)) {
                        return buildSettingFunctions[subSetting.type](subSetting as AdminDefinitionSetting);
                    }
                    return null;
                }}
            />
        );
    };

    // To satisfy type checking
    const nullFunction = () => {
        return null;
    };

    const buildSettingFunctions = {
        [Constants.SettingsTypes.TYPE_TEXT]: buildTextSetting,
        [Constants.SettingsTypes.TYPE_LONG_TEXT]: buildTextSetting,
        [Constants.SettingsTypes.TYPE_NUMBER]: buildTextSetting,
        [Constants.SettingsTypes.TYPE_BOOL]: buildBoolSetting,
        [Constants.SettingsTypes.TYPE_DROPDOWN]: buildDropdownSetting,
        [Constants.SettingsTypes.TYPE_BUTTON]: buildButtonSetting,
        [Constants.SettingsTypes.TYPE_JOBSTABLE]: buildJobsTableSetting,
        [Constants.SettingsTypes.TYPE_FILE_UPLOAD]: buildFileUploadSetting,
        [Constants.SettingsTypes.TYPE_CUSTOM]: buildCustomSetting,
        [Constants.SettingsTypes.TYPE_EXPANDABLE_SETTING]: buildExpandableSetting,
        [Constants.SettingsTypes.TYPE_COLOR]: nullFunction,
        [Constants.SettingsTypes.TYPE_PERMISSION]: nullFunction,
        [Constants.SettingsTypes.TYPE_RADIO]: nullFunction,
        [Constants.SettingsTypes.TYPE_BANNER]: nullFunction,
        [Constants.SettingsTypes.TYPE_GENERATED]: nullFunction,
        [Constants.SettingsTypes.TYPE_USERNAME]: nullFunction,
        [Constants.SettingsTypes.TYPE_LANGUAGE]: nullFunction,
        [Constants.SettingsTypes.TYPE_ROLES]: nullFunction,
    };

    const isDisabled = (setting: AdminDefinitionSetting) => {
        if (typeof setting.isDisabled === 'function') {
            return setting.isDisabled(props.config, state, props.license, props.enterpriseReady, props.consoleAccess, props.cloud, props.isCurrentUserSystemAdmin);
        }
        return Boolean(setting.isDisabled);
    };

    const isHidden = (setting: AdminDefinitionSetting) => {
        if (typeof setting.isHidden === 'function') {
            return setting.isHidden(props.config, state, props.license);
        }
        return Boolean(setting.isHidden);
    };

    const renderTitle = () => {
        if (!schema) {
            return '';
        }

        let name: string | MessageDescriptor = schema.id;
        if (('name' in schema)) {
            name = schema.name;
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

    const doSubmit = async (
        getStateFromConfig: (
            config: Partial<AdminConfig>,
            schema: AdminDefinitionSubSectionSchema,
            roles?: Record<string, Role>,
        ) => Partial<State>,
    ) => {
        if (!schema) {
            return;
        }

        // clone config so that we aren't modifying data in the stores
        let config = JSON.parse(JSON.stringify(props.config));
        config = getConfigFromState(config, state, schema, isDisabled);

        const {error} = await props.patchConfig(config);
        if (error) {
            setState((prev) => ({
                ...prev,
                serverError: error.message,
                serverErrorId: error.id,
            }));
        } else {
            setState((prevState) => ({
                ...prevState,
                ...getStateFromConfig(config, schema),
            }));
        }

        const results = [];
        for (const saveAction of saveActions) {
            results.push(saveAction());
        }

        const hasSaveActionError = await Promise.all(results).then((values) => values.some(((value) => value.error && value.error.message)));

        const hasError = error || hasSaveActionError;
        if (hasError) {
            setState((prev) => ({
                ...prev,
                saving: false,
            }));
        } else {
            setState((prev) => ({
                ...prev,
                saving: false,
                saveNeeded: false,
                confirmNeededId: '',
                showConfirmId: '',
                clientWarning: '',
                serverError: null,
            }));
            props.setNavigationBlocked(false);
        }
    };

    const handleChange = (id: string, value: unknown, confirm = false, shouldSubmit = false, warning = false) => {
        let saveNeeded: State['saveNeeded'] = state.saveNeeded === 'permissions' ? 'both' : 'config';

        // Exception: Since OpenId-Custom is treated as feature discovery for Cloud Starter licenses, save button is disabled.
        const isCloudStarter = props.license.Cloud === 'true' && props.license.SkuShortName === 'starter';
        if (id === 'openidType' && value === 'openid' && isCloudStarter) {
            saveNeeded = false;
        }

        const clientWarning = warning === false ? state.clientWarning : warning;

        let confirmNeededId = confirm ? id : state.confirmNeededId;
        if (id === state.confirmNeededId && !confirm) {
            confirmNeededId = '';
        }

        setState((prev) => ({
            ...prev,
            saveNeeded,
            confirmNeededId,
            clientWarning,
            [id]: value,
        }));

        // Clear test results when user starts typing in test fields
        if (id in settingKeyToTestNameMap) {
            const testName = settingKeyToTestNameMap[id];

            setTestResults((prevResults) => {
                if (!prevResults) {
                    return null;
                }
                return prevResults.filter((result) => result.test_name !== testName);
            });
        }

        if (shouldSubmit) {
            doSubmit(SchemaAdminSettings.getStateFromConfig);
        }

        props.setNavigationBlocked(true);
    };

    const handleSubmit = async (
        e: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.FormEvent<HTMLFormElement>,
    ) => {
        e.preventDefault();

        if (state.confirmNeededId) {
            setState((prev) => ({
                ...prev,
                showConfirmId: prev.confirmNeededId,
            }));
            return;
        }

        setState((prev) => ({
            ...prev,
            saving: true,
            serverError: null,
        }));

        if (state.saveNeeded === 'both' || state.saveNeeded === 'config') {
            doSubmit(SchemaAdminSettings.getStateFromConfig);
        } else {
            setState((prev) => ({
                ...prev,
                saving: false,
                saveNeeded: false,
                serverError: null,
            }));
            props.setNavigationBlocked(false);
        }
    };

    const unRegisterSaveAction = useCallback((saveAction: () => Promise<{ error?: { message?: string } }>) => {
        setSaveActions((prev) => prev.filter((action) => action !== saveAction));
    }, []);

    const registerSaveAction = useCallback((saveAction: () => Promise<{ error?: { message?: string } }>) => {
        setSaveActions((prev) => [...prev, saveAction]);
    }, []);

    const setSaveNeeded = () => {
        setState((prev) => ({
            ...prev,
            saveNeeded: 'config',
        }));
        props.setNavigationBlocked(true);
    };

    const cancelSubmit = () => {
        setState((prev) => ({
            ...prev,
            showConfirmId: '',
        }));
    };

    const canSave = () => {
        if (!schema || !('settings' in schema) || !schema.settings) {
            return true;
        }

        for (const setting of schema.settings) {
            // Some settings are actually not settings (banner)
            // and don't have a key, skip those ones
            if (!('key' in setting) || !setting.key) {
                continue;
            }

            // don't validate elements set by env.
            if (isSetByEnv(setting.key, props.environmentConfig)) {
                continue;
            }

            if ('validate' in setting && setting.validate) {
                if ('isHidden' in setting) {
                    let hidden = false;
                    if (typeof setting.isHidden === 'function') {
                        hidden = setting.isHidden?.(props.config, state, props.license, props.enterpriseReady, props.consoleAccess, props.cloud, props.isCurrentUserSystemAdmin);
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
                const result = setting.validate(state[setting.key]);
                if (!result.isValid()) {
                    return false;
                }
            }
        }

        return true;
    };

    const hybridSchemaAndComponent = () => {
        if (schema && 'component' in schema && schema.component) {
            const CustomComponent = schema.component;
            return (
                <CustomComponent
                    {...props}
                    disabled={props.isDisabled}
                />
            );
        }
        return null;
    };

    const renderSidebar = () => {
        return (
            <div className='ldap-wizard-sidebar'>
                <div className='ldap-wizard-sidebar-header'>
                    <i className='icon icon-text-box-outline'/>
                    <FormattedMessage
                        id='admin.ldap_wizard.sections_header'
                        defaultMessage='Sections'
                    />
                </div>
                {memoizedSections.map((section) => (
                    <button
                        key={section.key + '-sidebar-item'}
                        className={`ldap-wizard-sidebar-item ${section.key === activeSectionKey ? 'ldap-wizard-sidebar-item--active' : ''}`}
                        onClick={() => {
                            const sectionElement = sectionRefs.current[section.key];
                            if (sectionElement) {
                                sectionElement.scrollIntoView({behavior: 'smooth', block: 'start'});
                            }
                        }}
                    >
                        {section.sectionTitle || section.title}
                    </button>
                ))}
            </div>
        );
    };

    const renderSettings = () => {
        const renderedSections = memoizedSections.map((section) => {
            const settingsList: React.ReactNode[] = [];
            if (section.settings) {
                section.settings.forEach((setting) => {
                    if (buildSettingFunctions[setting.type] && !isHidden(setting)) {
                        settingsList.push(buildSettingFunctions[setting.type](setting));
                    }
                });
            }

            if (section.component) {
                const CustomComponent = section.component;
                return (
                    <CustomComponent
                        settingsList={settingsList}
                        key={section.key}
                    />
                );
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

            return (
                <div
                    className={'config-section'}
                    key={section.key}
                    data-section-key={section.key}
                    ref={(el) => {
                        if (sectionRefs.current) {
                            sectionRefs.current[section.key] = el;
                        }
                    }}
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
                </div>
            );
        });

        return (
            <div>
                {renderedSections}
            </div>
        );
    };

    return (
        <div
            className={'wrapper--fixed ldap-wizard-wrapper'}
            data-testid={`sysconsole_section_${schema?.id}`}
        >
            {renderTitle()}
            <div className='ldap-wizard-content-wrapper'>
                {renderSidebar()}
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <form
                            className='form-horizontal'
                            onSubmit={handleSubmit}
                        >
                            {renderSettings()}
                        </form>
                        {hybridSchemaAndComponent()}
                    </div>
                </div>
            </div>
            <div className='admin-console-save'>
                <SaveButton
                    saving={state.saving}
                    disabled={!state.saveNeeded || (canSave && !canSave())}
                    onClick={handleSubmit}
                    savingMessage={props.intl.formatMessage({id: 'admin.saving', defaultMessage: 'Saving Config...'})}
                />
                <WithTooltip title={state?.serverError ?? ''}>
                    <div
                        className='error-message'
                        data-testid='errorMessage'
                    >
                        <FormError
                            iconClassName='fa-exclamation-triangle'
                            textClassName='has-warning'
                            error={state.clientWarning}
                        />
                        <FormError error={state.serverError}/>
                    </div>
                </WithTooltip>
            </div>
        </div>
    );
};

// Helper functions for filter, attribute, and group attribute test results
const settingKeyToTestNameMap: Record<string, string> = {
    'LdapSettings.BaseDN': 'BaseDN',
    'LdapSettings.UserFilter': 'UserFilter',
    'LdapSettings.GroupFilter': 'GroupFilter',
    'LdapSettings.GuestFilter': 'GuestFilter',
    'LdapSettings.AdminFilter': 'AdminFilter',
    'LdapSettings.IdAttribute': 'IdAttribute',
    'LdapSettings.LoginIdAttribute': 'LoginIdAttribute',
    'LdapSettings.UsernameAttribute': 'UsernameAttribute',
    'LdapSettings.EmailAttribute': 'EmailAttribute',
    'LdapSettings.FirstNameAttribute': 'FirstNameAttribute',
    'LdapSettings.LastNameAttribute': 'LastNameAttribute',
    'LdapSettings.NicknameAttribute': 'NicknameAttribute',
    'LdapSettings.PositionAttribute': 'PositionAttribute',
    'LdapSettings.PictureAttribute': 'PictureAttribute',
    'LdapSettings.GroupDisplayNameAttribute': 'GroupDisplayNameAttribute',
    'LdapSettings.GroupIdAttribute': 'GroupIdAttribute',
};

// Helper functions to categorize test types
const filterTestNames = new Set(['BaseDN', 'UserFilter', 'GroupFilter', 'GuestFilter', 'AdminFilter']);
const attributeTestNames = new Set(['IdAttribute', 'LoginIdAttribute', 'UsernameAttribute', 'EmailAttribute', 'FirstNameAttribute', 'LastNameAttribute', 'NicknameAttribute', 'PositionAttribute', 'PictureAttribute']);
const groupAttributeTestNames = new Set(['GroupDisplayNameAttribute', 'GroupIdAttribute']);

const isFilterTestName = (testName: string) => filterTestNames.has(testName);
const isAttributeTestName = (testName: string) => attributeTestNames.has(testName);
const isGroupAttributeTestName = (testName: string) => groupAttributeTestNames.has(testName);

export default LDAPWizard;
