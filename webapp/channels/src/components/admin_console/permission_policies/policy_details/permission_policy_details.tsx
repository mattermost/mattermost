// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback, useMemo, type JSX} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';
import {useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import {buttonClassNames} from '@mattermost/shared/components/button';
import {ACCESS_CONTROL_ACTION_CREATE_BURN_ON_READ, type AccessControlPolicy, type AccessControlPolicyRule} from '@mattermost/types/access_control';
import type {AccessControlSettings} from '@mattermost/types/config';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import {CHANNEL_ATTRIBUTES_OBJECT_TYPE} from '@mattermost/types/properties_user';

import {Client4} from 'mattermost-redux/client';
import {isPolicySimulationEnabled} from 'mattermost-redux/selectors/entities/general';
import type {ActionResult} from 'mattermost-redux/types/actions';

import SimulateAccessModal from 'components/admin_console/access_control/modals/simulate_access/simulate_access_modal';
import BlockableLink from 'components/admin_console/blockable_link';
import Card from 'components/card/card';
import TitleAndButtonCardHeader from 'components/card/title_and_button_card_header/title_and_button_card_header';
import * as Menu from 'components/menu';
import SaveButton from 'components/save_button';
import SectionNotice from 'components/section_notice';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import TextSetting from 'components/widgets/settings/text_setting';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {useEnabledSessionAttributeFields} from 'hooks/useEnabledSessionAttributeFields';
import {getHistory} from 'utils/browser_history';
import {getUserPropertyFieldLabel} from 'utils/properties';

import RuleEditorCard, {type EditorMode} from './rule_editor_card';
import {SCOPE_COPY, type PolicyScope} from './scope_copy';

import {
    BOT_ROLE_KEY,
    BOT_SCOPE_PROP,
    getSyncedAttributeReferences,
    isBotScopePolicy,
    toServerRole,
    unwrapBotExpression,
    wrapBotExpression,
} from '../../access_control/bot_scope';
import {hasBalancedParens} from '../../access_control/cel_lexer';
import {hasUsableAttributes, isSimpleExpression, mergeSessionAttributes} from '../../access_control/editors/shared';
import {AVAILABLE_ROLES, roleMessages} from '../roles';

import './permission_policy_details.scss';

const permissionMessages = defineMessages({
    downloadLabel: {id: 'admin.permission_policies.permission.download_file.label', defaultMessage: 'Download Files'},
    downloadDescription: {id: 'admin.permission_policies.permission.download_file.description', defaultMessage: 'Allow users to download files to their device'},
    uploadLabel: {id: 'admin.permission_policies.permission.upload_file.label', defaultMessage: 'Upload Files'},
    uploadDescription: {id: 'admin.permission_policies.permission.upload_file.description', defaultMessage: 'Allow users to upload files while sending a message'},
    createBorLabel: {id: 'admin.permission_policies.permission.create_bor.label', defaultMessage: 'Create Burn-on-Read Message'},
    createBorDescription: {id: 'admin.permission_policies.permission.create_bor.description', defaultMessage: 'Allow users to send burn-on-read messages'},
});

const botScopeErrorMessages = defineMessages({
    invalid: {
        id: 'admin.permission_policies.edit.error.bot_expression_invalid',
        defaultMessage: 'This expression isn\'t valid. Check parentheses and quotes.',
    },
    invalidWithDetail: {
        id: 'admin.permission_policies.edit.error.bot_expression_invalid_detail',
        defaultMessage: 'This expression isn\'t valid. Check parentheses and quotes. Details: {error}',
    },
    checkFailed: {
        id: 'admin.permission_policies.edit.error.bot_expression_check_failed',
        defaultMessage: 'Couldn\'t validate the expression. Try again.',
    },
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

const AVAILABLE_PERMISSIONS: PermissionDefinition[] = [
    {
        value: 'download_file_attachment',
        label: permissionMessages.downloadLabel,
        description: permissionMessages.downloadDescription,
    },
    {
        value: 'upload_file_attachment',
        label: permissionMessages.uploadLabel,
        description: permissionMessages.uploadDescription,
    },
    {
        value: ACCESS_CONTROL_ACTION_CREATE_BURN_ON_READ,
        label: permissionMessages.createBorLabel,
        description: permissionMessages.createBorDescription,
    },
];

interface PermissionDefinition {
    value: string;
    label: MessageDescriptor;
    description: MessageDescriptor;
}

interface PolicyActions {
    fetchPolicy: (id: string) => Promise<ActionResult>;
    createPolicy: (policy: AccessControlPolicy) => Promise<ActionResult>;
    deletePolicy: (id: string) => Promise<ActionResult>;
    setNavigationBlocked: (blocked: boolean) => void;
}

export interface PermissionPolicyDetailsProps {
    policy?: AccessControlPolicy;
    policyId?: string;
    accessControlSettings: AccessControlSettings;
    sessionAttributesEnabled: boolean;
    actions: PolicyActions;
}

function getPermissionActions(rules: AccessControlPolicyRule[]): string[] {
    const allActions = rules.flatMap((r) => r.actions || []);
    return [...new Set(allActions)];
}

function buildRulesWithActions(expression: string, selectedActions: string[], botScope: boolean): AccessControlPolicyRule[] {
    const trimmed = expression.trim();
    if (!trimmed || selectedActions.length === 0) {
        return [];
    }
    return [{actions: selectedActions, expression: botScope ? wrapBotExpression(trimmed) : trimmed}];
}

function PermissionPolicyDetails({
    policy,
    policyId,
    actions,
    accessControlSettings,
    sessionAttributesEnabled,
}: PermissionPolicyDetailsProps): JSX.Element {
    const [policyName, setPolicyName] = useState(policy?.name || '');

    // Not seeded from `policy`: the list leaves the search endpoint's copy in the
    // store, and search returns rules in their stored form — a rank comparison is
    // stored desugared as `_rank_ge(...)`, which /cel/visual_ast rejects, so the
    // editor would fire a doomed parse on mount. fetchPolicy below is the only
    // source; it also sets the name, role and permissions seeded here.
    const [expression, setExpression] = useState('');
    const [selectedRole, setSelectedRole] = useState(policy?.roles?.[0] || 'system_user');
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
        getPermissionActions(policy?.rules || []),
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
    const [showTest, setShowTest] = useState(false);

    const isBotScope = selectedRole === BOT_ROLE_KEY;
    const scope: PolicyScope = isBotScope ? 'bot' : 'user';

    const {formatMessage, formatList} = useIntl();
    const abacActions = useChannelAccessControlActions();

    // Gate the "Simulate rules" button + modal. The
    // /cel/simulate_users endpoint returns 501 when this is off, so
    // hiding the UI here keeps the author from clicking a button
    // that would only surface a backend error. Mirror gate exists on
    // the channel-settings Permissions Policy tab.
    const policySimulationEnabled = useSelector(isPolicySimulationEnabled);

    // /cel/simulate_users rejects an empty action list, so the simulator also needs a selected permission.
    const simulateAvailable = policySimulationEnabled && selectedPermissions.length > 0;

    // The autocomplete mixes the requesting user's attributes (user.attributes.*)
    // and the accessed channel's attributes (resource.attributes.*), tagged by
    // object_type. Permission policies are channel-scoped, so they may reference
    // resource.attributes.*; split so user fields drive rules and channel fields
    // are comparison targets.
    const {userFields, resourceFields} = useMemo(() => {
        const uf: UserPropertyField[] = [];
        const rf: UserPropertyField[] = [];
        for (const f of autocompleteResult) {
            if (f.object_type === CHANNEL_ATTRIBUTES_OBJECT_TYPE) {
                rf.push(f);
            } else {
                uf.push(f);
            }
        }
        return {userFields: uf, resourceFields: rf};
    }, [autocompleteResult]);

    // Permission policies can reference session attributes (e.g. user.session.ip_address),
    // so the editor stays usable even without any configured user attributes when SessionAttributes is on.
    const noUsableAttributes = attributesLoaded && !sessionAttributesEnabled && !hasUsableAttributes(userFields, accessControlSettings.EnableUserManagedAttributes);

    const sessionFields = useEnabledSessionAttributeFields(sessionAttributesEnabled);
    const mergedAttributes = useMemo(
        () => mergeSessionAttributes(autocompleteResult, sessionFields),
        [autocompleteResult, sessionFields],
    );

    const syncedRefs = useMemo(
        () => (isBotScope ? getSyncedAttributeReferences(expression, userFields) : []),
        [isBotScope, expression, userFields],
    );

    useEffect(() => {
        loadPage().finally(() => setPageLoaded(true));
    }, [policyId]);

    const loadPage = async (): Promise<void> => {
        setLoadFailed(false);

        // Permission policies can reference resource.attributes.* (the accessed
        // channel), so request channel fields too.
        const fieldsPromise = abacActions.getAccessControlFields('', 100, true).then((result) => {
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
                const botScope = loaded ? isBotScopePolicy(loaded) : false;
                const raw = rules[0]?.expression || '';
                const inner = botScope ? unwrapBotExpression(raw) : raw;

                setPolicyName(loaded?.name || '');
                setSelectedRole(botScope ? BOT_ROLE_KEY : loaded?.roles?.[0] || 'system_user');
                setExpression(inner);
                setSelectedPermissions(getPermissionActions(rules));
                setEditorMode(isSimpleExpression(inner) ? 'table' : 'cel');
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
        if (!selectedRole) {
            setServerError(formatMessage({
                id: 'admin.permission_policies.edit.error.role_required',
                defaultMessage: 'Please select a role',
            }));
            return false;
        }
        if (selectedPermissions.length === 0) {
            setServerError(formatMessage({
                id: 'admin.permission_policies.edit.error.permissions_required',
                defaultMessage: 'Please select at least one permission',
            }));
            return false;
        }
        return true;
    };

    const validateBotScopeExpression = async (bare: string): Promise<string | undefined> => {
        if (!hasBalancedParens(bare)) {
            return formatMessage(botScopeErrorMessages.invalid);
        }
        let errors;
        try {
            errors = await Client4.checkAccessControlExpression(bare);
        } catch {
            return formatMessage(botScopeErrorMessages.checkFailed);
        }
        if (errors?.length) {
            return formatMessage(botScopeErrorMessages.invalidWithDetail, {error: errors[0].message});
        }
        return undefined;
    };

    const handleSubmit = async () => {
        if (saving || !preSaveCheck()) {
            return;
        }

        setSaving(true);
        try {
            if (isBotScope) {
                const validationError = await validateBotScopeExpression(expression.trim());
                if (validationError) {
                    setServerError(validationError);
                    return;
                }
                setServerError(undefined);
            }

            const result = await actions.createPolicy({
                id: policyId || '',
                name: policyName,
                rules: buildRulesWithActions(expression, selectedPermissions, isBotScope),
                roles: [toServerRole(selectedRole)],
                type: 'permission',
                ...(isBotScope ? {props: {[BOT_SCOPE_PROP]: true}} : {}),
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
            getHistory().push('/admin_console/system_attributes/permission_policies');
        } finally {
            setSaving(false);
        }
    };

    const handleTestClick = () => setShowTest(true);

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
            getHistory().push('/admin_console/system_attributes/permission_policies');
        } catch (error: any) {
            setServerError(formatMessage({
                id: 'admin.permission_policies.edit.error.delete',
                defaultMessage: 'Error deleting policy: {error}',
            }, {error: error.message}));
        }
    };

    const addPermission = (permValue: string) => {
        if (!selectedPermissions.includes(permValue)) {
            setSelectedPermissions((prev) => [...prev, permValue]);
            markDirty();
        }
    };

    const removePermission = (permValue: string) => {
        setSelectedPermissions((prev) => prev.filter((p) => p !== permValue));
        markDirty();
    };

    const availableToAdd = AVAILABLE_PERMISSIONS.filter(
        (p) => !selectedPermissions.includes(p.value),
    );

    return (
        <div className='wrapper--fixed PermissionPolicySettings'>
            <AdminHeader withBackButton={true}>
                <div>
                    <BlockableLink
                        to='/admin_console/system_attributes/permission_policies'
                        className='fa fa-angle-left back'
                    />
                    <FormattedMessage
                        id='admin.permission_policies.edit.title'
                        defaultMessage='Attribute-Based Permission Policy'
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
                                text={serverError}
                            />
                        </div>
                    </div>
                </div>
            )}
            {pageLoaded && !loadFailed && (
                <>
                    <div className='admin-console__wrapper'>
                        <div className='admin-console__content'>
                            {/* Policy Name */}
                            <div className='admin-console__setting-group'>
                                <TextSetting
                                    id='admin.permission_policies.edit.policyName'
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

                            {/* Info Banner */}
                            <div className='pp-info-banner'>
                                <i className='icon icon-information-outline'/>
                                <div className='pp-info-banner-content'>
                                    <span className='pp-info-banner-title'>
                                        <FormattedMessage
                                            id='admin.permission_policies.edit.info_banner.title'
                                            defaultMessage='The permissions defined in this policy override the {link} when its conditions are met'
                                            values={{
                                                link: (
                                                    <BlockableLink
                                                        to='/admin_console/user_management/permissions'
                                                        className='pp-info-banner-link'
                                                    >
                                                        <FormattedMessage
                                                            id='admin.permission_policies.edit.info_banner.link'
                                                            defaultMessage='system permission schemes'
                                                        />
                                                    </BlockableLink>
                                                ),
                                            }}
                                        />
                                    </span>
                                    <span className='pp-info-banner-subtitle'>
                                        <FormattedMessage
                                            id='admin.permission_policies.edit.info_banner.evaluation_order'
                                            defaultMessage='Permissions evaluation order: Permission policies (evaluated first) → System scheme / Team override scheme (fallback when no policy applies).'
                                        />
                                    </span>
                                </div>
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
                                        text={formatMessage({
                                            id: 'admin.permission_policies.edit.notice.text',
                                            defaultMessage: 'You haven\'t configured any user attributes yet. Attribute-Based Access Control requires user attributes that are either synced from an external system (like LDAP or SAML) or manually configured and enabled on this server.',
                                        })}
                                        primaryButton={{
                                            text: formatMessage({
                                                id: 'admin.permission_policies.edit.notice.button',
                                                defaultMessage: 'Configure user attributes',
                                            }),
                                            onClick: () => {
                                                getHistory().push('/admin_console/system_attributes/manage_attributes');
                                            },
                                        }}
                                    />
                                </div>
                            )}

                            {/* "Who this policy applies to" */}
                            <Card
                                expanded={true}
                                className={'console'}
                            >
                                <Card.Header>
                                    <TitleAndButtonCardHeader
                                        title={
                                            <FormattedMessage
                                                id='admin.permission_policies.edit.who.title'
                                                defaultMessage='Who this policy applies to'
                                            />
                                        }
                                        subtitle={<FormattedMessage {...SCOPE_COPY[scope].whoSubtitle}/>}
                                    />
                                </Card.Header>
                                <Card.Body>
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
                                                        <i className='icon icon-chevron-down'/>
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
                                                    trailingElements={selectedRole === role.value ? <i className='icon icon-check'/> : undefined}
                                                />
                                            ))}
                                        </Menu.Container>
                                    </div>
                                </Card.Body>
                            </Card>

                            {syncedRefs.length > 0 && (
                                <div className='admin-console__warning-notice'>
                                    <SectionNotice
                                        type='warning'
                                        title={formatMessage(syncedBotMessages.title)}
                                        text={formatMessage(syncedBotMessages.text, {
                                            attributes: formatList(syncedRefs.map((f) => `\`${getUserPropertyFieldLabel(f).replace(/`/g, '')}\``), {type: 'conjunction'}),
                                            count: syncedRefs.length,
                                        })}
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
                                resourceFields={resourceFields}
                                mergedAttributes={mergedAttributes}
                                enableUserManagedAttributes={accessControlSettings.EnableUserManagedAttributes}
                                abacActions={abacActions}
                                onTestClick={simulateAvailable ? handleTestClick : undefined}
                            />

                            {/* "What permissions are modified" */}
                            <Card
                                expanded={true}
                                className={'console'}
                            >
                                <Card.Header>
                                    <TitleAndButtonCardHeader
                                        title={
                                            <FormattedMessage
                                                id='admin.permission_policies.edit.permissions.title'
                                                defaultMessage='What permissions are modified'
                                            />
                                        }
                                        subtitle={
                                            <FormattedMessage
                                                id='admin.permission_policies.edit.permissions.subtitle'
                                                defaultMessage='These permissions override the default system permission scheme when policy conditions are met'
                                            />
                                        }
                                    />
                                </Card.Header>
                                <Card.Body>
                                    <div className='pp-permissions-table'>
                                        <div className='pp-permissions-table-header'>
                                            <FormattedMessage
                                                id='admin.permission_policies.edit.permissions.column_header'
                                                defaultMessage='Permission'
                                            />
                                        </div>
                                        {selectedPermissions.length === 0 ? (
                                            <div className='pp-permissions-table-empty'>
                                                <FormattedMessage
                                                    id='admin.permission_policies.edit.permissions.empty'
                                                    defaultMessage='Add a permission to this policy'
                                                />
                                            </div>
                                        ) : (
                                            selectedPermissions.map((permValue) => {
                                                const permDef = AVAILABLE_PERMISSIONS.find((p) => p.value === permValue);
                                                return (
                                                    <div
                                                        key={permValue}
                                                        className='pp-permissions-table-row'
                                                    >
                                                        <span className='pp-permission-label'>
                                                            {permDef ? formatMessage(permDef.label) : permValue}
                                                        </span>
                                                        <button
                                                            className='pp-permission-remove'
                                                            onClick={() => removePermission(permValue)}
                                                            aria-label={formatMessage({
                                                                id: 'admin.permission_policies.edit.permissions.remove_aria',
                                                                defaultMessage: 'Remove permission',
                                                            })}
                                                        >
                                                            <i className='icon icon-trash-can-outline'/>
                                                        </button>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                    {availableToAdd.length > 0 && (
                                        <Menu.Container
                                            menuButton={{
                                                id: 'pp-add-permission-btn',
                                                class: 'pp-add-permission-button',
                                                children: (
                                                    <>
                                                        <i className='icon icon-plus'/>
                                                        <FormattedMessage
                                                            id='admin.permission_policies.edit.permissions.add'
                                                            defaultMessage='Add permission'
                                                        />
                                                    </>
                                                ),
                                            }}
                                            menu={{
                                                id: 'pp-add-permission-menu',
                                                'aria-label': formatMessage({
                                                    id: 'admin.permission_policies.edit.permissions.menu_aria',
                                                    defaultMessage: 'Add permission menu',
                                                }),
                                            }}
                                        >
                                            {availableToAdd.map((perm) => (
                                                <Menu.Item
                                                    key={perm.value}
                                                    id={`pp-add-permission-${perm.value}`}
                                                    onClick={() => addPermission(perm.value)}
                                                    labels={
                                                        <>
                                                            <span>{formatMessage(perm.label)}</span>
                                                            <span>{formatMessage(perm.description)}</span>
                                                        </>
                                                    }
                                                />
                                            ))}
                                        </Menu.Container>
                                    )}
                                </Card.Body>
                            </Card>

                            {/* Delete Section */}
                            {policyId && (
                                <Card
                                    expanded={true}
                                    className={'console delete-policy'}
                                >
                                    <Card.Header>
                                        <TitleAndButtonCardHeader
                                            title={
                                                <FormattedMessage
                                                    id='admin.permission_policies.edit.delete.title'
                                                    defaultMessage='Delete policy'
                                                />
                                            }
                                            subtitle={
                                                <FormattedMessage
                                                    id='admin.permission_policies.edit.delete.subtitle'
                                                    defaultMessage='This policy will be deleted and cannot be recovered.'
                                                />
                                            }
                                            buttonText={
                                                <FormattedMessage
                                                    id='admin.permission_policies.edit.delete.button'
                                                    defaultMessage='Delete'
                                                />
                                            }
                                            onClick={() => setShowDeleteConfirmationModal(true)}
                                        />
                                    </Card.Header>
                                </Card>
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
                            confirmButtonVariant='destructive'
                            compassDesign={true}
                        >
                            <FormattedMessage
                                id='admin.permission_policies.edit.delete_confirmation.message'
                                defaultMessage='Are you sure you want to delete this policy? This action cannot be undone.'
                            />
                        </GenericModal>
                    )}

                    {policySimulationEnabled && showTest && (
                        <SimulateAccessModal
                            onExited={() => setShowTest(false)}
                            policy={{
                                id: policyId || '',
                                name: policyName,
                                type: 'permission',
                                roles: [toServerRole(selectedRole)],
                                rules: buildRulesWithActions(expression, selectedPermissions, isBotScope),
                            }}
                            actions={selectedPermissions}
                            ruleName={policyName}
                            actionLabels={{
                                upload_file_attachment: formatMessage(permissionMessages.uploadLabel),
                                download_file_attachment: formatMessage(permissionMessages.downloadLabel),
                                [ACCESS_CONTROL_ACTION_CREATE_BURN_ON_READ]: formatMessage(permissionMessages.createBorLabel),
                            }}
                            targetRole={toServerRole(selectedRole)}
                            targetScope='system'
                            accessControlFields={mergedAttributes}
                        />
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
                        <BlockableLink
                            className={buttonClassNames({emphasis: 'quaternary'})}
                            to='/admin_console/system_attributes/permission_policies'
                        >
                            <FormattedMessage
                                id='admin.permission_policies.edit.cancel'
                                defaultMessage='Cancel'
                            />
                        </BlockableLink>
                        {serverError && (
                            <span className='pp-error'>
                                <i className='icon icon-alert-outline'/>
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

export default PermissionPolicyDetails;
