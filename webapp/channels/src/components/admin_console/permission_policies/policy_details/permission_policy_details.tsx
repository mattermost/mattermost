// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useMemo, useCallback} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import {buttonClassNames} from '@mattermost/shared/components/button';
import type {AccessControlPolicy, AccessControlPolicyRule} from '@mattermost/types/access_control';
import type {AccessControlSettings} from '@mattermost/types/config';
import type {UserPropertyField} from '@mattermost/types/properties';

import type {ActionResult} from 'mattermost-redux/types/actions';

import BlockableLink from 'components/admin_console/blockable_link';
import Card from 'components/card/card';
import TitleAndButtonCardHeader from 'components/card/title_and_button_card_header/title_and_button_card_header';
import * as Menu from 'components/menu';
import SaveButton from 'components/save_button';
import SectionNotice from 'components/section_notice';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import TextSetting from 'components/widgets/settings/text_setting';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {getHistory} from 'utils/browser_history';

import CELEditor from '../../access_control/editors/cel_editor/editor';
import {hasUsableAttributes} from '../../access_control/editors/shared';
import TableEditor from '../../access_control/editors/table_editor/table_editor';

import './permission_policy_details.scss';

const roleMessages = defineMessages({
    guestLabel: {id: 'admin.permission_policies.role.system_guest.label', defaultMessage: 'Guest users'},
    guestDescription: {id: 'admin.permission_policies.role.system_guest.description', defaultMessage: 'Applies only to guest users'},
    memberLabel: {id: 'admin.permission_policies.role.system_user.label', defaultMessage: 'Members and system administrators'},
    memberDescription: {id: 'admin.permission_policies.role.system_user.description', defaultMessage: 'Applies to regular members and administrators'},
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
}: PermissionPolicyDetailsProps): JSX.Element {
    const [policyName, setPolicyName] = useState(policy?.name || '');
    const [expression, setExpression] = useState(policy?.rules?.[0]?.expression || '');
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

    const {formatMessage} = useIntl();
    const abacActions = useChannelAccessControlActions();

    const noUsableAttributes = attributesLoaded && !hasUsableAttributes(autocompleteResult, accessControlSettings.EnableUserManagedAttributes);

    useEffect(() => {
        loadPage().finally(() => setPageLoaded(true));
    }, [policyId]);

    const isSimpleExpression = (expr: string): boolean => {
        if (!expr) {
            return true;
        }
        return expr.split('&&').every((condition) => {
            const trimmed = condition.trim();
            return trimmed.match(/^user\.attributes\.\w+\s*(==|!=)\s*['"][^'"]*['"]$/) ||
                   trimmed.match(/^user\.attributes\.\w+\s+in\s+\[.*?\]$/) ||
                   trimmed.match(/^((\[.*?\])||['"][^'"]*['"].*?)\s+in\s+user\.attributes\.\w+$/) ||
                   trimmed.match(/^user\.attributes\.\w+\.startsWith\(['"][^'"]*['"].*?\)$/) ||
                   trimmed.match(/^user\.attributes\.\w+\.endsWith\(['"][^'"]*['"].*?\)$/) ||
                   trimmed.match(/^user\.attributes\.\w+\.contains\(['"][^'"]*['"].*?\)$/);
        });
    };

    const loadPage = async (): Promise<void> => {
        const fieldsPromise = abacActions.getAccessControlFields('', 100).then((result) => {
            if (result.data) {
                setAutocompleteResult(result.data);
            }
            setAttributesLoaded(true);
        });

        if (policyId) {
            const policyPromise = actions.fetchPolicy(policyId).then((result: ActionResult) => {
                if (result.error) {
                    setServerError(result.error.message || formatMessage({
                        id: 'admin.permission_policies.edit.error.load',
                        defaultMessage: 'Failed to load policy',
                    }));
                    return;
                }
                const loadedExpression = result.data?.rules?.[0]?.expression || '';
                setPolicyName(result.data?.name || '');
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

    const handleSubmit = async () => {
        if (!preSaveCheck()) {
            return;
        }

        setSaving(true);
        try {
            const result = await actions.createPolicy({
                id: policyId || '',
                name: policyName,
                rules: buildRulesWithActions(expression, selectedPermissions),
                roles: [selectedRole],
                type: 'permission',
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

    const filteredAttributes = useMemo(() => {
        return autocompleteResult.filter((attr) => {
            if (accessControlSettings.EnableUserManagedAttributes) {
                return true;
            }
            const isSynced = attr.attrs?.ldap || attr.attrs?.saml;
            const isAdminManaged = attr.attrs?.managed === 'admin';
            const isProtected = attr.attrs?.protected;
            return isSynced || isAdminManaged || isProtected;
        });
    }, [autocompleteResult, accessControlSettings.EnableUserManagedAttributes]);

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
                        defaultMessage='Attribute Based Permission Policy'
                    />
                </div>
            </AdminHeader>
            {pageLoaded ? (
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
                                                getHistory().push('/admin_console/system_attributes/user_attributes');
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
                                        subtitle={
                                            <FormattedMessage
                                                id='admin.permission_policies.edit.who.subtitle'
                                                defaultMessage='Define rules based on user attributes and values'
                                            />
                                        }
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

                            {/* Attribute-based access rules */}
                            <Card
                                expanded={true}
                                className={'console'}
                            >
                                <Card.Header>
                                    <TitleAndButtonCardHeader
                                        title={
                                            <FormattedMessage
                                                id='admin.permission_policies.edit.who.attributes_title'
                                                defaultMessage='User attribute requirements'
                                            />
                                        }
                                        subtitle={
                                            <FormattedMessage
                                                id='admin.permission_policies.edit.who.attributes_subtitle'
                                                defaultMessage='Select attributes and values that users must have for this policy'
                                            />
                                        }
                                        buttonText={
                                            editorMode === 'table' ? (
                                                <FormattedMessage
                                                    id='admin.permission_policies.edit.switch_to_advanced'
                                                    defaultMessage='Switch to Advanced Mode'
                                                />
                                            ) : (
                                                <FormattedMessage
                                                    id='admin.permission_policies.edit.switch_to_simple'
                                                    defaultMessage='Switch to Simple Mode'
                                                />
                                            )
                                        }
                                        onClick={() => setEditorMode(editorMode === 'table' ? 'cel' : 'table')}
                                        isDisabled={noUsableAttributes || (editorMode === 'cel' && !isSimpleExpression(expression))}
                                        tooltipText={(() => {
                                            if (noUsableAttributes) {
                                                return formatMessage({
                                                    id: 'admin.permission_policies.edit.no_usable_attributes_tooltip',
                                                    defaultMessage: 'Please configure user attributes to use the editor.',
                                                });
                                            }
                                            if (editorMode === 'cel' && !isSimpleExpression(expression)) {
                                                return formatMessage({
                                                    id: 'admin.permission_policies.edit.complex_expression_tooltip',
                                                    defaultMessage: 'Complex expression detected. Simple expressions editor is not available at the moment.',
                                                });
                                            }
                                            return undefined;
                                        })()}
                                    />
                                </Card.Header>
                                <Card.Body>
                                    {editorMode === 'cel' ? (
                                        <CELEditor
                                            value={expression}
                                            onChange={(value) => {
                                                setExpression(value);
                                                markDirty();
                                            }}
                                            onValidate={() => {}}
                                            disabled={noUsableAttributes}
                                            userAttributes={filteredAttributes.map((attr) => ({
                                                attribute: attr.name,
                                                values: [],
                                            }))}
                                        />
                                    ) : (
                                        <TableEditor
                                            value={expression}
                                            onChange={(value) => {
                                                setExpression(value);
                                                markDirty();
                                            }}
                                            onValidate={() => {}}
                                            disabled={noUsableAttributes}
                                            userAttributes={autocompleteResult}
                                            onParseError={() => {
                                                setEditorMode('cel');
                                            }}
                                            enableUserManagedAttributes={accessControlSettings.EnableUserManagedAttributes}
                                            actions={abacActions}
                                        />
                                    )}
                                </Card.Body>
                            </Card>

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
            ) : (
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'/>
                </div>
            )}
        </div>
    );
}

export default PermissionPolicyDetails;
