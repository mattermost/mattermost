// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {forwardRef, useState, useEffect, useCallback, useMemo, type JSX} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';
import {useSelector} from 'react-redux';

import {PlusIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/compass-ui/components/button';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {SectionNotice} from '@mattermost/compass-ui/components/section-notice';
import {GenericModal} from '@mattermost/components';
import {ACCESS_CONTROL_ACTION_CREATE_BURN_ON_READ, type AccessControlPolicy, type AccessControlPolicyRule} from '@mattermost/types/access_control';
import type {AccessControlSettings} from '@mattermost/types/config';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import {CHANNEL_ATTRIBUTES_OBJECT_TYPE} from '@mattermost/types/properties_user';

import {isPolicySimulationEnabled} from 'mattermost-redux/selectors/entities/general';
import type {ActionResult} from 'mattermost-redux/types/actions';

import SimulateAccessModal from 'components/admin_console/access_control/modals/simulate_access/simulate_access_modal';
import BlockableLink from 'components/admin_console/blockable_link';
import * as Menu from 'components/menu';
import type {MenuButtonComponentProps} from 'components/menu';
import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {useEnabledSessionAttributeFields} from 'hooks/useEnabledSessionAttributeFields';
import {getHistory} from 'utils/browser_history';

import PolicyExpressionSection from './policy_expression_section';
import PolicySectionsNav, {scrollSectionIntoView} from './policy_sections_nav';
import type {PolicySection} from './policy_sections_nav';

import {hasUsableAttributes, isSimpleExpression, mergeSessionAttributes} from '../../access_control/editors/shared';

import './permission_policy_details.scss';

const AddPermissionMenuTrigger = forwardRef<HTMLButtonElement, MenuButtonComponentProps>((props, ref) => {
    const {children, ...rest} = props;
    return (
        <Button
            {...rest}
            ref={ref}
            emphasis='tertiary'
            size='small'
            className='pp-add-permission-button'
            leadingIcon={<Icon glyph={<PlusIcon/>}/>}
        >
            {children}
        </Button>
    );
});
AddPermissionMenuTrigger.displayName = 'AddPermissionMenuTrigger';

const roleMessages = defineMessages({
    guestLabel: {id: 'admin.permission_policies.role.system_guest.label', defaultMessage: 'Guest users'},
    guestDescription: {id: 'admin.permission_policies.role.system_guest.description', defaultMessage: 'Applies only to guest users'},
    memberLabel: {id: 'admin.permission_policies.role.system_user.label', defaultMessage: 'Members'},
    memberDescription: {id: 'admin.permission_policies.role.system_user.description', defaultMessage: 'Applies to regular members. System administrators also fall back to this rule if no admin-specific policy with the same permissions exists.'},
    adminLabel: {id: 'admin.permission_policies.role.system_admin.label', defaultMessage: 'System administrators'},
    adminDescription: {id: 'admin.permission_policies.role.system_admin.description', defaultMessage: 'Applies only to system administrators'},
    selectRole: {id: 'admin.permission_policies.role.select', defaultMessage: 'Select a role'},
});

const AVAILABLE_ROLES: RoleDefinition[] = [
    {value: 'system_guest', label: roleMessages.guestLabel, description: roleMessages.guestDescription},
    {value: 'system_user', label: roleMessages.memberLabel, description: roleMessages.memberDescription},
    {value: 'system_admin', label: roleMessages.adminLabel, description: roleMessages.adminDescription},
];

const permissionMessages = defineMessages({
    downloadLabel: {id: 'admin.permission_policies.permission.download_file.label', defaultMessage: 'Download Files'},
    downloadDescription: {id: 'admin.permission_policies.permission.download_file.description', defaultMessage: 'Allow users to download files to their device'},
    uploadLabel: {id: 'admin.permission_policies.permission.upload_file.label', defaultMessage: 'Upload Files'},
    uploadDescription: {id: 'admin.permission_policies.permission.upload_file.description', defaultMessage: 'Allow users to upload files while sending a message'},
    createBorLabel: {id: 'admin.permission_policies.permission.create_bor.label', defaultMessage: 'Create Burn-on-Read Message'},
    createBorDescription: {id: 'admin.permission_policies.permission.create_bor.description', defaultMessage: 'Allow users to send burn-on-read messages'},
});

const panelMessages = defineMessages({
    detailsTitle: {id: 'admin.permission_policies.edit.details.title', defaultMessage: 'Policy details'},
    detailsSubtitle: {id: 'admin.permission_policies.edit.details.subtitle', defaultMessage: 'Add information about this policy that will be used to identify it'},
    nameLabel: {id: 'admin.permission_policies.edit.details.name_label', defaultMessage: 'Policy name'},
    descriptionLabel: {id: 'admin.permission_policies.edit.details.description_label', defaultMessage: 'Policy description'},
    descriptionPlaceholder: {id: 'admin.permission_policies.edit.details.description_placeholder', defaultMessage: 'Why this policy exists, for example, the requirement or ticket behind it'},
    whoTitle: {id: 'admin.permission_policies.edit.who.title', defaultMessage: 'Who this applies to'},
    whoSubtitle: {id: 'admin.permission_policies.edit.who.subtitle', defaultMessage: 'Select the role that this policy applies to'},
    expressionTitle: {id: 'admin.permission_policies.edit.who.attributes_title', defaultMessage: 'Policy expression'},
    expressionSubtitle: {id: 'admin.permission_policies.edit.who.attributes_subtitle', defaultMessage: 'Rules can use user attributes, and can compare them with channel attributes.'},
    permissionsTitle: {id: 'admin.permission_policies.edit.permissions.title', defaultMessage: 'Permissions'},
    permissionsSubtitle: {id: 'admin.permission_policies.edit.permissions.subtitle', defaultMessage: 'These override the default permission scheme when the expression is true'},
    permissionsDescription: {id: 'admin.permission_policies.edit.permissions.description_header', defaultMessage: 'Description'},
    deleteTitle: {id: 'admin.permission_policies.edit.delete.title', defaultMessage: 'Delete policy'},
    deleteSubtitle: {id: 'admin.permission_policies.edit.delete.subtitle', defaultMessage: 'This policy will be deleted and cannot be recovered.'},
    deleteButton: {id: 'admin.permission_policies.edit.delete.button', defaultMessage: 'Delete'},
});

const POLICY_SECTIONS: PolicySection[] = [
    {id: 'permission_policy_details', label: panelMessages.detailsTitle},
    {id: 'permission_policy_who', label: panelMessages.whoTitle},
    {id: 'permission_policy_expression', label: panelMessages.expressionTitle},
    {id: 'permission_policy_permissions', label: panelMessages.permissionsTitle},
];

type SectionId = typeof POLICY_SECTIONS[number]['id'];

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

interface RoleDefinition {
    value: string;
    label: MessageDescriptor;
    description: MessageDescriptor;
}

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

function buildRulesWithActions(expression: string, selectedActions: string[]): AccessControlPolicyRule[] {
    if (!expression.trim() || selectedActions.length === 0) {
        return [];
    }
    return [{actions: selectedActions, expression: expression.trim()}];
}

function PermissionPolicyDetails({
    policy,
    policyId,
    actions,
    accessControlSettings,
    sessionAttributesEnabled,
}: PermissionPolicyDetailsProps): JSX.Element {
    const [policyName, setPolicyName] = useState(policy?.name || '');
    const [policyDescription, setPolicyDescription] = useState(policy?.description || '');
    const [sectionError, setSectionError] = useState<SectionId | undefined>(undefined);
    const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

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
    const [editorMode, setEditorMode] = useState<'cel' | 'table'>('table');
    const [saveNeeded, setSaveNeeded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [autocompleteResult, setAutocompleteResult] = useState<UserPropertyField[]>([]);
    const [attributesLoaded, setAttributesLoaded] = useState(false);
    const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] = useState(false);
    const [pageLoaded, setPageLoaded] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [showTest, setShowTest] = useState(false);

    const {formatMessage} = useIntl();
    const abacActions = useChannelAccessControlActions();

    // Gate the "Simulate rules" button + modal. The
    // /cel/simulate_users endpoint returns 501 when this is off, so
    // hiding the UI here keeps the author from clicking a button
    // that would only surface a backend error. Mirror gate exists on
    // the channel-settings Permissions Policy tab.
    const policySimulationEnabled = useSelector(isPolicySimulationEnabled);

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

    useEffect(() => {
        loadPage().finally(() => setPageLoaded(true));
    }, [policyId]);

    // isSimpleExpression imported from ../../access_control/editors/shared so
    // native user attributes (user.email, user.createat.youngerThanDays(...), etc.)
    // are recognized as simple and open in table mode.

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
                const loadedExpression = result.data?.rules?.[0]?.expression || '';
                setPolicyName(result.data?.name || '');
                setPolicyDescription(result.data?.description || '');
                setExpression(loadedExpression);
                setSelectedRole(result.data?.roles?.[0] || 'system_user');
                setSelectedPermissions(getPermissionActions(result.data?.rules || []));
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

    const failSection = (section: SectionId, message: string) => {
        setSectionError(section);
        setServerError(message);
        const el = document.getElementById(section);
        if (el && scrollEl) {
            scrollSectionIntoView(scrollEl, el);
        }
        return false;
    };

    const preSaveCheck = () => {
        if (policyName.trim().length === 0) {
            return failSection('permission_policy_details', formatMessage({
                id: 'admin.permission_policies.edit.error.name_required',
                defaultMessage: 'Please add a name to the policy',
            }));
        }
        if (expression.trim().length === 0) {
            return failSection('permission_policy_expression', formatMessage({
                id: 'admin.permission_policies.edit.error.expression_required',
                defaultMessage: 'Please add an expression to the policy',
            }));
        }
        if (!selectedRole) {
            return failSection('permission_policy_who', formatMessage({
                id: 'admin.permission_policies.edit.error.role_required',
                defaultMessage: 'Please select a role',
            }));
        }
        if (selectedPermissions.length === 0) {
            return failSection('permission_policy_permissions', formatMessage({
                id: 'admin.permission_policies.edit.error.permissions_required',
                defaultMessage: 'Please select at least one permission',
            }));
        }
        setSectionError(undefined);
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
                description: policyDescription.trim(),
                rules: buildRulesWithActions(expression, selectedPermissions),
                roles: [selectedRole],
                type: 'permission',
            });

            if (result.error) {
                if (result.error.server_error_id === 'app.pap.save_policy.name_exists.app_error') {
                    failSection('permission_policy_details', formatMessage({
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
                                description={serverError}
                            />
                        </div>
                    </div>
                </div>
            )}
            {pageLoaded && !loadFailed && (
                <>
                    <div
                        className='admin-console__wrapper'
                        ref={setScrollEl}
                    >
                        <div className='admin-console__content pp-authoring'>
                            <PolicySectionsNav
                                sections={POLICY_SECTIONS}
                                scrollEl={scrollEl}
                                errorSectionId={sectionError}
                            />
                            <div className='pp-authoring__main'>
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
                                    id='permission_policy_details'
                                    title={panelMessages.detailsTitle}
                                    subtitle={panelMessages.detailsSubtitle}
                                >
                                    <div className='pp-field'>
                                        <label htmlFor='permission-policy-name'>
                                            <FormattedMessage {...panelMessages.nameLabel}/>
                                        </label>
                                        <input
                                            id='permission-policy-name'
                                            className='form-control'
                                            type='text'
                                            value={policyName}
                                            autoFocus={policyId === undefined}
                                            placeholder={formatMessage({
                                                id: 'admin.permission_policies.edit.policyName.placeholder',
                                                defaultMessage: 'Add a unique policy name',
                                            })}
                                            onChange={(event) => {
                                                setPolicyName(event.target.value);
                                                markDirty();
                                            }}
                                        />
                                    </div>
                                    <div className='pp-field'>
                                        <label htmlFor='permission-policy-description'>
                                            <FormattedMessage {...panelMessages.descriptionLabel}/>
                                        </label>
                                        <textarea
                                            id='permission-policy-description'
                                            className='form-control'
                                            rows={3}
                                            value={policyDescription}
                                            placeholder={formatMessage(panelMessages.descriptionPlaceholder)}
                                            onChange={(event) => {
                                                setPolicyDescription(event.target.value);
                                                markDirty();
                                            }}
                                        />
                                    </div>
                                </AdminPanel>

                                <AdminPanel
                                    id='permission_policy_who'
                                    title={panelMessages.whoTitle}
                                    subtitle={panelMessages.whoSubtitle}
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
                                </AdminPanel>

                                <PolicyExpressionSection
                                    title={panelMessages.expressionTitle}
                                    subtitle={panelMessages.expressionSubtitle}
                                    editorMode={editorMode}
                                    onEditorModeChange={setEditorMode}
                                    expression={expression}
                                    onExpressionChange={(value) => {
                                        setExpression(value);
                                        markDirty();
                                    }}
                                    noUsableAttributes={noUsableAttributes}
                                    userFields={userFields}
                                    sessionFields={sessionFields}
                                    resourceFields={resourceFields}
                                    mergedAttributes={mergedAttributes}
                                    enableUserManagedAttributes={accessControlSettings.EnableUserManagedAttributes}
                                    actions={abacActions}
                                    onParseError={() => {
                                        setEditorMode('cel');
                                    }}
                                    onTestClick={policySimulationEnabled && selectedPermissions.length > 0 ? () => setShowTest(true) : undefined}
                                />

                                <AdminPanel
                                    id='permission_policy_permissions'
                                    title={panelMessages.permissionsTitle}
                                    subtitle={panelMessages.permissionsSubtitle}
                                >
                                    <div className={`pp-permissions-table ${selectedPermissions.length > 0 ? 'pp-permissions-table--with-rows' : ''}`}>
                                        <div className='pp-permissions-table-header'>
                                            <span>
                                                <FormattedMessage
                                                    id='admin.permission_policies.edit.permissions.column_header'
                                                    defaultMessage='Permission'
                                                />
                                            </span>
                                            {selectedPermissions.length > 0 && (
                                                <span>
                                                    <FormattedMessage {...panelMessages.permissionsDescription}/>
                                                </span>
                                            )}
                                            {selectedPermissions.length > 0 && <span className='pp-permissions-table-header-action'/>}
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
                                                        <span className='pp-permission-description'>
                                                            {permDef ? formatMessage(permDef.description) : ''}
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
                                                as: AddPermissionMenuTrigger,
                                                children: (
                                                    <FormattedMessage
                                                        id='admin.permission_policies.edit.permissions.add'
                                                        defaultMessage='Add permission'
                                                    />
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
                                </AdminPanel>

                                {/* Delete Section */}
                                {policyId && (
                                    <AdminPanel
                                        id='permission_policy_delete'
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

                    {policySimulationEnabled && showTest && (
                        <SimulateAccessModal
                            onExited={() => setShowTest(false)}
                            policy={{
                                id: policyId || '',
                                name: policyName,
                                type: 'permission',
                                roles: [selectedRole],
                                rules: buildRulesWithActions(expression, selectedPermissions),
                            }}
                            actions={selectedPermissions}
                            ruleName={policyName}
                            actionLabels={{
                                upload_file_attachment: formatMessage(permissionMessages.uploadLabel),
                                download_file_attachment: formatMessage(permissionMessages.downloadLabel),
                                [ACCESS_CONTROL_ACTION_CREATE_BURN_ON_READ]: formatMessage(permissionMessages.createBorLabel),
                            }}
                            targetRole={selectedRole}
                            targetScope='system'
                            accessControlFields={mergedAttributes}
                        />
                    )}

                    <div className='admin-console-save'>
                        <SaveButton
                            disabled={!saveNeeded}
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
                            <BlockableLink to='/admin_console/system_attributes/permission_policies'>
                                <FormattedMessage
                                    id='admin.permission_policies.edit.cancel'
                                    defaultMessage='Cancel'
                                />
                            </BlockableLink>
                        </Button>
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
