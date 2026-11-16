// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {forwardRef, useState, useEffect, useCallback, useMemo, type JSX} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import {useLocation} from 'react-router-dom';

import {AlertOutlineIcon, CheckIcon, ChevronDownIcon, PlusIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/compass-ui/components/button';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {Radio} from '@mattermost/compass-ui/components/radio';
import {SectionNotice} from '@mattermost/compass-ui/components/section-notice';
import {GenericModal} from '@mattermost/components';
import {
    ACCESS_CONTROL_POLICY_TYPE_SYSTEM_SETTING,
    type AccessControlPolicy,
    type AccessControlPolicyRule,
} from '@mattermost/types/access_control';
import type {AccessControlSettings} from '@mattermost/types/config';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import {CHANNEL_ATTRIBUTES_OBJECT_TYPE} from '@mattermost/types/properties_user';

import type {ActionResult} from 'mattermost-redux/types/actions';

import BlockableLink from 'components/admin_console/blockable_link';
import Markdown from 'components/markdown';
import * as Menu from 'components/menu';
import type {MenuButtonComponentProps} from 'components/menu';
import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import AdminPanel from 'components/widgets/admin_console/admin_panel';
import TextSetting from 'components/widgets/settings/text_setting';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {useEnabledSessionAttributeFields} from 'hooks/useEnabledSessionAttributeFields';
import {getHistory} from 'utils/browser_history';
import {getUserPropertyFieldLabel} from 'utils/properties';

import {SYSTEM_BOT_ROLE, getHiddenNativeReferences, getSyncedAttributeReferences} from '../../access_control/bot_scope';
import {hasUsableAttributes, isNativeField, isSimpleExpression, mergeSessionAttributes} from '../../access_control/editors/shared';
import RuleEditorCard, {type EditorMode, type PolicyScope} from '../../permission_policies/policy_details/rule_editor_card';
import {AVAILABLE_ROLES, roleMessages} from '../../permission_policies/roles';
import {
    AVAILABLE_SYSTEM_SETTINGS,
    SCOPED_CONFIGURATION_LIST_ROUTE,
    getSystemSettingDefinition,
    isValidSystemSettingValue,
    type SystemSettingConfigDefinition,
} from '../settings';

import './scoped_configuration_details.scss';

const AddConfigurationMenuTrigger = forwardRef<HTMLButtonElement, MenuButtonComponentProps>((props, ref) => {
    const {children, ...rest} = props;
    return (
        <Button
            {...rest}
            ref={ref}
            emphasis='tertiary'
            size='small'
            leadingIcon={<Icon glyph={<PlusIcon/>}/>}
        >
            {children}
        </Button>
    );
});
AddConfigurationMenuTrigger.displayName = 'AddConfigurationMenuTrigger';

const whoSubtitleMessages = defineMessages({
    user: {id: 'admin.permission_policies.edit.who.subtitle', defaultMessage: 'Define rules based on user attributes and values'},
    bot: {id: 'admin.permission_policies.edit.who.subtitle_bot', defaultMessage: 'Define rules based on bot attributes and values'},
});

const syncedBotMessages = defineMessages({
    title: {
        id: 'admin.permission_policies.edit.notice.synced_bot.title',
        defaultMessage: 'Bots can\'t hold synced attributes',
    },
    text: {
        id: 'admin.permission_policies.edit.notice.synced_bot.text',
        defaultMessage: '{attributes} {count, plural, one {is} other {are}} synced from LDAP or SAML, and bots can\'t hold synced values. This policy will deny every bot.',
    },
});

const hiddenNativeBotMessages = defineMessages({
    title: {
        id: 'admin.permission_policies.edit.notice.hidden_native_bot.title',
        defaultMessage: 'Some attributes aren\'t available for bots',
    },
    text: {
        id: 'admin.permission_policies.edit.notice.hidden_native_bot.text',
        defaultMessage: '{count, plural, one {{attributes} can\'t be used in Bot accounts policies. Remove it from the rules to save this policy.} other {{attributes} can\'t be used in Bot accounts policies. Remove them from the rules to save this policy.}}',
    },
    error: {
        id: 'admin.permission_policies.edit.error.hidden_native_bot',
        defaultMessage: 'Remove {attributes} from the rules. Bot accounts policies can\'t use {count, plural, one {this attribute} other {these attributes}}.',
    },
});

const panelMessages = defineMessages({
    whoTitle: {
        id: 'admin.permission_policies.edit.who.title',
        defaultMessage: 'Who this policy applies to',
    },
    configurationTitle: {
        id: 'admin.scoped_configuration.edit.configuration.title',
        defaultMessage: 'What configuration is affected',
    },
    configurationSubtitle: {
        id: 'admin.scoped_configuration.edit.configuration.subtitle',
        defaultMessage: 'These configuration values override the default System Console settings when policy conditions are met',
    },
    deleteTitle: {
        id: 'admin.permission_policies.edit.delete.title',
        defaultMessage: 'Delete policy',
    },
    deleteSubtitle: {
        id: 'admin.permission_policies.edit.delete.subtitle',
        defaultMessage: 'This policy will be deleted and cannot be recovered.',
    },
    deleteButton: {
        id: 'admin.permission_policies.edit.delete.button',
        defaultMessage: 'Delete',
    },
});

type SelectedSettingEntry = {
    key: string;
    value: string;
};

interface PolicyActions {
    fetchPolicy: (id: string) => Promise<ActionResult>;
    createPolicy: (policy: AccessControlPolicy) => Promise<ActionResult>;
    deletePolicy: (id: string) => Promise<ActionResult>;
    setNavigationBlocked: (blocked: boolean) => void;
}

export interface ScopedConfigurationDetailsProps {
    policy?: AccessControlPolicy;
    policyId?: string;
    settingKey?: string;
    accessControlSettings: AccessControlSettings;
    sessionAttributesEnabled: boolean;
    actions: PolicyActions;
}

function extractSettingEntries(rules: AccessControlPolicyRule[], prefillKey?: string | null): SelectedSettingEntry[] {
    const entries: SelectedSettingEntry[] = [];
    const seen = new Set<string>();
    for (const rule of rules) {
        for (const key of rule.actions || []) {
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            const def = getSystemSettingDefinition(key);
            entries.push({
                key,
                value: rule.value ?? def?.defaultValue ?? '',
            });
        }
    }

    if (entries.length === 0 && prefillKey) {
        const def = getSystemSettingDefinition(prefillKey);
        if (def) {
            entries.push({key: def.key, value: def.defaultValue});
        }
    }

    return entries;
}

function buildRulesFromEntries(expression: string, entries: SelectedSettingEntry[]): AccessControlPolicyRule[] {
    const trimmed = expression.trim();
    if (!trimmed || entries.length === 0) {
        return [];
    }
    return entries.map(({key, value}) => ({
        actions: [key],
        expression: trimmed,
        value,
    }));
}

interface SettingValueControlProps {
    definition?: SystemSettingConfigDefinition;
    settingKey: string;
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
}

function SettingValueControl({definition, settingKey, value, disabled, onChange}: SettingValueControlProps): JSX.Element {
    const {formatMessage} = useIntl();
    const valueType = definition?.valueType ?? 'string';

    if (valueType === 'bool') {
        return (
            <div className='ScopedConfigurationSettings__bool-radios'>
                <Radio
                    data-testid={`scoped-setting-value-${settingKey}-true`}
                    name={`scoped-setting-${settingKey}`}
                    value='true'
                    checked={value === 'true'}
                    disabled={disabled}
                    onChange={() => onChange('true')}
                >
                    <FormattedMessage
                        id='admin.true'
                        defaultMessage='True'
                    />
                </Radio>
                <Radio
                    data-testid={`scoped-setting-value-${settingKey}-false`}
                    name={`scoped-setting-${settingKey}`}
                    value='false'
                    checked={value === 'false'}
                    disabled={disabled}
                    onChange={() => onChange('false')}
                >
                    <FormattedMessage
                        id='admin.false'
                        defaultMessage='False'
                    />
                </Radio>
            </div>
        );
    }

    if (valueType === 'select' && definition?.options) {
        return (
            <select
                data-testid={`scoped-setting-value-${settingKey}`}
                className='form-control ScopedConfigurationSettings__value-input'
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
            >
                {definition.options.map((opt) => (
                    <option
                        key={opt.value}
                        value={opt.value}
                    >
                        {formatMessage(opt.label)}
                    </option>
                ))}
            </select>
        );
    }

    return (
        <input
            data-testid={`scoped-setting-value-${settingKey}`}
            type={valueType === 'number' ? 'number' : 'text'}
            className='form-control ScopedConfigurationSettings__value-input'
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

export default function ScopedConfigurationDetails({
    policy,
    policyId,
    settingKey,
    actions,
    accessControlSettings,
    sessionAttributesEnabled,
}: ScopedConfigurationDetailsProps): JSX.Element {
    const location = useLocation();
    const prefillSettingKey = useMemo(() => {
        if (policyId) {
            return null;
        }
        return settingKey || new URLSearchParams(location.search).get('setting');
    }, [location.search, policyId, settingKey]);

    const [policyName, setPolicyName] = useState(policy?.name || '');
    const [expression, setExpression] = useState('');
    const [selectedRole, setSelectedRole] = useState(policy?.roles?.[0] || 'system_user');
    const [selectedSettings, setSelectedSettings] = useState<SelectedSettingEntry[]>(() =>
        extractSettingEntries(policy?.rules || [], prefillSettingKey),
    );
    const [serverError, setServerError] = useState<string | undefined>(undefined);
    const [editorMode, setEditorMode] = useState<EditorMode>('table');
    const [saveNeeded, setSaveNeeded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [autocompleteResult, setAutocompleteResult] = useState<UserPropertyField[]>([]);
    const [attributesLoaded, setAttributesLoaded] = useState(false);
    const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] = useState(false);
    const [pageLoaded, setPageLoaded] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);

    const isBotScope = selectedRole === SYSTEM_BOT_ROLE;
    const scope: PolicyScope = isBotScope ? 'bot' : 'user';

    const {formatMessage, formatList} = useIntl();
    const abacActions = useChannelAccessControlActions();

    const userFields = useMemo(
        () => autocompleteResult.filter((f) => f.object_type !== CHANNEL_ATTRIBUTES_OBJECT_TYPE),
        [autocompleteResult],
    );

    const noUsableAttributes = attributesLoaded && !sessionAttributesEnabled && !hasUsableAttributes(userFields, accessControlSettings.EnableUserManagedAttributes);

    const sessionFields = useEnabledSessionAttributeFields(sessionAttributesEnabled);
    const mergedAttributes = useMemo(
        () => mergeSessionAttributes(userFields, sessionFields),
        [userFields, sessionFields],
    );

    const syncedRefs = useMemo(
        () => (isBotScope ? getSyncedAttributeReferences(expression, userFields) : []),
        [isBotScope, expression, userFields],
    );

    const hiddenNativeLabels = useMemo(() => {
        if (!isBotScope) {
            return [];
        }
        return getHiddenNativeReferences(expression).map((name) => {
            const field = userFields.find((f) => f.name === name && isNativeField(f));
            return field ? getUserPropertyFieldLabel(field) : name;
        });
    }, [isBotScope, expression, userFields]);

    useEffect(() => {
        if (!policyId) {
            setPolicyName('');
            setSelectedRole('system_user');
            setExpression('');
            setSelectedSettings(extractSettingEntries([], prefillSettingKey));
            setEditorMode('table');
            setSaveNeeded(false);
            setServerError(undefined);
        }
        loadPage().finally(() => setPageLoaded(true));
    }, [policyId, prefillSettingKey]);

    const loadPage = async (): Promise<void> => {
        setLoadFailed(false);

        const fieldsPromise = abacActions.getAccessControlFields('', 100, false).then((result) => {
            if (result.data) {
                setAutocompleteResult(result.data);
            }
            setAttributesLoaded(true);
        });

        if (policyId) {
            const policyPromise = actions.fetchPolicy(policyId).then((result: ActionResult) => {
                if (result.error) {
                    setLoadFailed(true);
                    setServerError(result.error.message || formatMessage({
                        id: 'admin.permission_policies.edit.error.load',
                        defaultMessage: 'Failed to load policy',
                    }));
                    return;
                }
                const loaded: AccessControlPolicy | undefined = result.data;
                const rules = loaded?.rules || [];
                const loadedExpression = rules[0]?.expression || '';

                setPolicyName(loaded?.name || '');
                setSelectedRole(loaded?.roles?.[0] || 'system_user');
                setExpression(loadedExpression);
                setSelectedSettings(extractSettingEntries(rules));
                setEditorMode(isSimpleExpression(loadedExpression) ? 'table' : 'cel');
            });
            await Promise.all([fieldsPromise, policyPromise]);
        } else {
            await fieldsPromise;
        }
    };

    const markDirty = useCallback(() => {
        setSaveNeeded(true);
        actions.setNavigationBlocked(true);
    }, [actions]);

    const handleExpressionChange = (value: string) => {
        setExpression(value);
        markDirty();
    };

    const preSaveCheck = () => {
        if (policyName.trim().length === 0) {
            setServerError(formatMessage({
                id: 'admin.permission_policies.edit.error.name_required',
                defaultMessage: 'Please add a name to the policy',
            }));
            return false;
        }
        if (expression.trim().length === 0) {
            setServerError(formatMessage({
                id: 'admin.permission_policies.edit.error.expression_required',
                defaultMessage: 'Please add an expression to the policy',
            }));
            return false;
        }
        if (!AVAILABLE_ROLES.some((role) => role.value === selectedRole)) {
            setServerError(formatMessage({
                id: 'admin.permission_policies.edit.error.role_required',
                defaultMessage: 'Please select a role',
            }));
            return false;
        }
        if (hiddenNativeLabels.length > 0) {
            setServerError(formatMessage(hiddenNativeBotMessages.error, {
                attributes: formatList(hiddenNativeLabels, {type: 'conjunction'}),
                count: hiddenNativeLabels.length,
            }));
            return false;
        }
        if (selectedSettings.length === 0) {
            setServerError(formatMessage({
                id: 'admin.scoped_configuration.edit.error.configuration_required',
                defaultMessage: 'Please select at least one configuration setting',
            }));
            return false;
        }
        for (const entry of selectedSettings) {
            const def = getSystemSettingDefinition(entry.key);
            if (def && !isValidSystemSettingValue(def, entry.value)) {
                setServerError(formatMessage({
                    id: 'admin.scoped_configuration.edit.error.invalid_value',
                    defaultMessage: 'Please enter a valid value for {setting}',
                }, {setting: formatMessage(def.label)}));
                return false;
            }
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!preSaveCheck()) {
            return;
        }

        setSaving(true);
        try {
            const result = await actions.createPolicy({
                id: policyId || '',
                name: policyName,
                rules: buildRulesFromEntries(expression, selectedSettings),
                roles: [selectedRole],
                type: ACCESS_CONTROL_POLICY_TYPE_SYSTEM_SETTING,
            });

            if (result.error) {
                if (result.error.server_error_id === 'app.pap.save_policy.name_exists.app_error') {
                    setServerError(formatMessage({
                        id: 'admin.permission_policies.edit.name_exists',
                        defaultMessage: 'A policy with this name already exists. Please choose a different name.',
                    }));
                } else {
                    setServerError(result.error.message);
                }
                return;
            }

            setSaveNeeded(false);
            actions.setNavigationBlocked(false);
            getHistory().push(SCOPED_CONFIGURATION_LIST_ROUTE);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!policyId) {
            return;
        }
        try {
            const result = await actions.deletePolicy(policyId);
            if (result.error) {
                setServerError(formatMessage({
                    id: 'admin.permission_policies.edit.error.delete',
                    defaultMessage: 'Error deleting policy: {error}',
                }, {error: String(result.error.message || result.error)}));
                return;
            }
            actions.setNavigationBlocked(false);
            getHistory().push(SCOPED_CONFIGURATION_LIST_ROUTE);
        } catch (error: any) {
            setServerError(formatMessage({
                id: 'admin.permission_policies.edit.error.delete',
                defaultMessage: 'Error deleting policy: {error}',
            }, {error: error.message}));
        }
    };

    const addConfigurationSetting = (def: SystemSettingConfigDefinition) => {
        if (!selectedSettings.some((item) => item.key === def.key)) {
            setSelectedSettings((prev) => [...prev, {key: def.key, value: def.defaultValue}]);
            markDirty();
        }
    };

    const updateSettingValue = (settingKey: string, nextValue: string) => {
        setSelectedSettings((prev) => prev.map((item) => (item.key === settingKey ? {...item, value: nextValue} : item)));
        markDirty();
    };

    const removeConfigurationSetting = (settingKey: string) => {
        setSelectedSettings((prev) => prev.filter((item) => item.key !== settingKey));
        markDirty();
    };

    const availableToAdd = AVAILABLE_SYSTEM_SETTINGS.filter(
        (def) => !selectedSettings.some((item) => item.key === def.key),
    );

    return (
        <div className='wrapper--fixed PermissionPolicySettings ScopedConfigurationSettings'>
            <AdminHeader withBackButton={true}>
                <div>
                    <BlockableLink
                        to={SCOPED_CONFIGURATION_LIST_ROUTE}
                        className='fa fa-angle-left back'
                    />
                    <FormattedMessage
                        id='admin.scoped_configuration.edit.title'
                        defaultMessage='Scoped Configuration Policy'
                    />
                </div>
            </AdminHeader>
            {pageLoaded && loadFailed && (
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <div className='admin-console__warning-notice'>
                            <SectionNotice
                                type='danger'
                                title={formatMessage({
                                    id: 'admin.permission_policies.edit.error.load',
                                    defaultMessage: 'Failed to load policy',
                                })}
                                description={serverError}
                            />
                        </div>
                    </div>
                </div>
            )}
            {pageLoaded && !loadFailed && (
                <>
                    <div className='admin-console__wrapper'>
                        <div className='admin-console__content'>
                            <div className='admin-console__setting-group'>
                                <TextSetting
                                    id='admin.scoped_configuration.edit.policyName'
                                    label={
                                        <FormattedMessage
                                            id='admin.permission_policies.edit.policyName.label'
                                            defaultMessage='Access policy name:'
                                        />
                                    }
                                    value={policyName}
                                    placeholder={formatMessage({
                                        id: 'admin.permission_policies.edit.policyName.placeholder',
                                        defaultMessage: 'Add a unique policy name',
                                    })}
                                    onChange={(_, value) => {
                                        setPolicyName(value);
                                        markDirty();
                                    }}
                                    labelClassName='col-sm-4 vertically-centered-label'
                                    inputClassName='col-sm-8'
                                    autoFocus={policyId === undefined}
                                />
                            </div>

                            <div className='pp-info-notice'>
                                <SectionNotice
                                    type='info'
                                    title={
                                        <FormattedMessage
                                            id='admin.scoped_configuration.edit.info_banner.title'
                                            defaultMessage='The configuration defined in this policy overrides the default System Console setting when its conditions are met'
                                        />
                                    }
                                    description={
                                        <FormattedMessage
                                            id='admin.scoped_configuration.edit.info_banner.description'
                                            defaultMessage='Users and sessions that do not match this policy keep the default value configured in the System Console.'
                                        />
                                    }
                                />
                            </div>

                            {noUsableAttributes && (
                                <div className='admin-console__warning-notice'>
                                    <SectionNotice
                                        type='warning'
                                        title={
                                            <FormattedMessage
                                                id='admin.permission_policies.edit.notice.title'
                                                defaultMessage='Please add user attributes and values to use Attribute-Based Access Control'
                                            />
                                        }
                                        description={formatMessage({
                                            id: 'admin.permission_policies.edit.notice.text',
                                            defaultMessage: 'You haven\'t configured any user attributes yet. Attribute-Based Access Control requires user attributes that are either synced from an external system (like LDAP or SAML) or manually configured and enabled on this server.',
                                        })}
                                        primaryButtonLabel={formatMessage({
                                            id: 'admin.permission_policies.edit.notice.button',
                                            defaultMessage: 'Configure user attributes',
                                        })}
                                        onPrimaryAction={() => {
                                            getHistory().push('/admin_console/system_attributes/manage_attributes');
                                        }}
                                    />
                                </div>
                            )}

                            <AdminPanel
                                id='scoped_configuration_who'
                                title={panelMessages.whoTitle}
                                subtitle={whoSubtitleMessages[scope]}
                            >
                                <div className='pp-role-selector'>
                                    <span className='pp-role-selector-label'>
                                        <FormattedMessage
                                            id='admin.permission_policies.edit.who.role_label'
                                            defaultMessage='Select a role from the predefined list of system roles'
                                        />
                                    </span>
                                    <Menu.Container
                                        menuButton={{
                                            id: 'pp-role-selector-btn',
                                            class: 'pp-role-dropdown-button',
                                            children: (
                                                <>
                                                    <span>{(() => {
                                                        const found = AVAILABLE_ROLES.find((r) => r.value === selectedRole);
                                                        return found ? formatMessage(found.label) : formatMessage(roleMessages.selectRole);
                                                    })()}</span>
                                                    <ChevronDownIcon size={18}/>
                                                </>
                                            ),
                                        }}
                                        menu={{
                                            id: 'pp-role-selector-menu',
                                            'aria-label': formatMessage({
                                                id: 'admin.permission_policies.edit.who.role_menu_aria',
                                                defaultMessage: 'Role selection menu',
                                            }),
                                        }}
                                    >
                                        {AVAILABLE_ROLES.map((role) => (
                                            <Menu.Item
                                                key={role.value}
                                                id={`pp-role-option-${role.value}`}
                                                onClick={() => {
                                                    setSelectedRole(role.value);
                                                    markDirty();
                                                }}
                                                labels={
                                                    <>
                                                        <span>{formatMessage(role.label)}</span>
                                                        <span>{formatMessage(role.description)}</span>
                                                    </>
                                                }
                                                trailingElements={selectedRole === role.value ? <CheckIcon size={18}/> : undefined}
                                            />
                                        ))}
                                    </Menu.Container>
                                </div>
                            </AdminPanel>

                            {syncedRefs.length > 0 && (
                                <div className='admin-console__warning-notice'>
                                    <SectionNotice
                                        type='warning'
                                        title={formatMessage(syncedBotMessages.title)}
                                        description={
                                            <Markdown
                                                message={formatMessage(syncedBotMessages.text, {
                                                    attributes: formatList(syncedRefs.map((f) => `\`${getUserPropertyFieldLabel(f).replace(/`/g, '')}\``), {type: 'conjunction'}),
                                                    count: syncedRefs.length,
                                                })}
                                            />
                                        }
                                    />
                                </div>
                            )}

                            {hiddenNativeLabels.length > 0 && (
                                <div className='admin-console__warning-notice'>
                                    <SectionNotice
                                        type='warning'
                                        title={formatMessage(hiddenNativeBotMessages.title)}
                                        description={
                                            <Markdown
                                                message={formatMessage(hiddenNativeBotMessages.text, {
                                                    attributes: formatList(hiddenNativeLabels.map((label) => `\`${label.replace(/`/g, '')}\``), {type: 'conjunction'}),
                                                    count: hiddenNativeLabels.length,
                                                })}
                                            />
                                        }
                                    />
                                </div>
                            )}

                            <RuleEditorCard
                                scope={scope}
                                expression={expression}
                                editorMode={editorMode}
                                onExpressionChange={handleExpressionChange}
                                onEditorModeChange={setEditorMode}
                                disabled={saving}
                                noUsableAttributes={noUsableAttributes}
                                userFields={userFields}
                                sessionFields={sessionFields}
                                resourceFields={[]}
                                mergedAttributes={mergedAttributes}
                                enableUserManagedAttributes={accessControlSettings.EnableUserManagedAttributes}
                                abacActions={abacActions}
                                hideTestButton={true}
                            />

                            <AdminPanel
                                id='scoped_configuration_settings'
                                title={panelMessages.configurationTitle}
                                subtitle={panelMessages.configurationSubtitle}
                            >
                                <div className='pp-permissions-table ScopedConfigurationSettings__table'>
                                    <div className='pp-permissions-table-header ScopedConfigurationSettings__table-header'>
                                        <span>
                                            <FormattedMessage
                                                id='admin.scoped_configuration.edit.configuration.column_header'
                                                defaultMessage='Configuration'
                                            />
                                        </span>
                                        <span>
                                            <FormattedMessage
                                                id='admin.scoped_configuration.edit.configuration.value_column_header'
                                                defaultMessage='Value'
                                            />
                                        </span>
                                        <span aria-hidden='true'/>
                                    </div>
                                    {selectedSettings.length === 0 ? (
                                        <div className='pp-permissions-table-empty'>
                                            <FormattedMessage
                                                id='admin.scoped_configuration.edit.configuration.empty'
                                                defaultMessage='Add a configuration setting to this policy'
                                            />
                                        </div>
                                    ) : (
                                        selectedSettings.map((entry) => {
                                            const def = getSystemSettingDefinition(entry.key);
                                            return (
                                                <div
                                                    key={entry.key}
                                                    data-testid={`scoped-setting-row-${entry.key}`}
                                                    className='pp-permissions-table-row ScopedConfigurationSettings__row'
                                                >
                                                    <span className='pp-permission-label'>
                                                        {def ? formatMessage(def.label) : entry.key}
                                                    </span>
                                                    <div className='ScopedConfigurationSettings__value-cell'>
                                                        <SettingValueControl
                                                            definition={def}
                                                            settingKey={entry.key}
                                                            value={entry.value}
                                                            disabled={saving}
                                                            onChange={(val) => updateSettingValue(entry.key, val)}
                                                        />
                                                    </div>
                                                    <button
                                                        type='button'
                                                        className='pp-permission-remove'
                                                        onClick={() => removeConfigurationSetting(entry.key)}
                                                        aria-label={formatMessage({
                                                            id: 'admin.scoped_configuration.edit.configuration.remove_aria',
                                                            defaultMessage: 'Remove configuration setting',
                                                        })}
                                                    >
                                                        <TrashCanOutlineIcon size={16}/>
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {availableToAdd.length > 0 && (
                                    <Menu.Container
                                        menuButton={{
                                            id: 'scoped-add-configuration-btn',
                                            as: AddConfigurationMenuTrigger,
                                            children: (
                                                <FormattedMessage
                                                    id='admin.scoped_configuration.edit.configuration.add'
                                                    defaultMessage='Add configuration'
                                                />
                                            ),
                                        }}
                                        menu={{
                                            id: 'scoped-add-configuration-menu',
                                            'aria-label': formatMessage({
                                                id: 'admin.scoped_configuration.edit.configuration.menu_aria',
                                                defaultMessage: 'Add configuration menu',
                                            }),
                                        }}
                                    >
                                        {availableToAdd.map((def) => (
                                            <Menu.Item
                                                key={def.key}
                                                id={`scoped-add-configuration-${def.key}`}
                                                onClick={() => addConfigurationSetting(def)}
                                                labels={
                                                    <>
                                                        <span>{formatMessage(def.label)}</span>
                                                        <span>{formatMessage(def.description)}</span>
                                                    </>
                                                }
                                            />
                                        ))}
                                    </Menu.Container>
                                )}
                            </AdminPanel>

                            {policyId && (
                                <AdminPanel
                                    id='scoped_configuration_delete'
                                    className='delete-policy'
                                    title={panelMessages.deleteTitle}
                                    subtitle={panelMessages.deleteSubtitle}
                                    button={
                                        <Button
                                            emphasis='primary'
                                            destructive={true}
                                            onClick={() => setShowDeleteConfirmationModal(true)}
                                        >
                                            <FormattedMessage {...panelMessages.deleteButton}/>
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                    </div>

                    {showDeleteConfirmationModal && (
                        <GenericModal
                            onExited={() => setShowDeleteConfirmationModal(false)}
                            handleConfirm={handleDelete}
                            handleCancel={() => setShowDeleteConfirmationModal(false)}
                            modalHeaderText={
                                <FormattedMessage
                                    id='admin.permission_policies.edit.delete_confirmation.title'
                                    defaultMessage='Confirm Policy Deletion'
                                />
                            }
                            confirmButtonText={
                                <FormattedMessage
                                    id='admin.permission_policies.edit.delete_confirmation.confirm'
                                    defaultMessage='Delete Policy'
                                />
                            }
                            destructive={true}
                            compassDesign={true}
                        >
                            <FormattedMessage
                                id='admin.permission_policies.edit.delete_confirmation.message'
                                defaultMessage='Are you sure you want to delete this policy? This action cannot be undone.'
                            />
                        </GenericModal>
                    )}

                    <div className='admin-console-save'>
                        <SaveButton
                            disabled={!saveNeeded || saving}
                            saving={saving}
                            onClick={handleSubmit}
                            defaultMessage={
                                <FormattedMessage
                                    id='admin.permission_policies.edit.save'
                                    defaultMessage='Save'
                                />
                            }
                        />
                        <Button
                            asChild={true}
                            emphasis='tertiary'
                        >
                            <BlockableLink to={SCOPED_CONFIGURATION_LIST_ROUTE}>
                                <FormattedMessage
                                    id='admin.permission_policies.edit.cancel'
                                    defaultMessage='Cancel'
                                />
                            </BlockableLink>
                        </Button>
                        {serverError && (
                            <span className='pp-error'>
                                <AlertOutlineIcon size={16}/>
                                <FormattedMessage
                                    id='admin.permission_policies.edit.serverError'
                                    defaultMessage='There are errors in the form above: {serverError}'
                                    values={{serverError}}
                                />
                            </span>
                        )}
                    </div>
                </>
            )}
            {!pageLoaded && (
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'/>
                </div>
            )}
        </div>
    );
}
