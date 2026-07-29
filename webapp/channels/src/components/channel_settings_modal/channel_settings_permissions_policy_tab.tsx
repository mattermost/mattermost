// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';
import {useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import type {AccessControlPolicy, AccessControlPolicyRule} from '@mattermost/types/access_control';
import {
    ACCESS_CONTROL_ACTION_DOWNLOAD_FILE,
    ACCESS_CONTROL_ACTION_UPLOAD_FILE,
    ACCESS_CONTROL_CHANNEL_ROLE_ADMIN,
    ACCESS_CONTROL_CHANNEL_ROLE_GUEST,
    ACCESS_CONTROL_CHANNEL_ROLE_USER,
    ACCESS_CONTROL_PERMISSION_ACTIONS,
    ACCESS_CONTROL_POLICY_VERSION_V0_4,
    buildRulesWithMembership,
    buildRulesWithPermissionRules,
    getMembershipRule,
    getPermissionRules,
    hasOverlappingPermissionRules,
} from '@mattermost/types/access_control';
import type {Channel} from '@mattermost/types/channels';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {getAccessControlSettings} from 'mattermost-redux/selectors/entities/access_control';
import {getFeatureFlagValue, isPolicySimulationEnabled} from 'mattermost-redux/selectors/entities/general';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {mergeSessionAttributes} from 'components/admin_console/access_control/editors/shared';
import TableEditor from 'components/admin_console/access_control/editors/table_editor/table_editor';
import SimulateAccessModal from 'components/admin_console/access_control/modals/simulate_access/simulate_access_modal';
import * as Menu from 'components/menu';
import SaveChangesPanel, {type SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {useChannelSystemPolicies} from 'hooks/useChannelSystemPolicies';
import {useEnabledSessionAttributeFields} from 'hooks/useEnabledSessionAttributeFields';

import type {GlobalState} from 'types/store';

import './channel_settings_access_rules_tab.scss';
import './channel_settings_permissions_policy_tab.scss';

const SAVE_RESULT_SAVED = 'saved' as const;
const SAVE_RESULT_ERROR = 'error' as const;
type SaveResult = typeof SAVE_RESULT_SAVED | typeof SAVE_RESULT_ERROR;

const PAGE_SIZE = 10;

type ChannelSettingsPermissionsPolicyTabProps = {
    channel: Channel;
    setAreThereUnsavedChanges?: (unsaved: boolean) => void;
    showTabSwitchError?: boolean;
};

const roleMessages = defineMessages({
    guestLabel: {
        id: 'channel_settings.permissions_policy.role.channel_guest',
        defaultMessage: 'Channel guest',
    },
    guestDescription: {
        id: 'channel_settings.permissions_policy.role.channel_guest.description',
        defaultMessage: 'Applies only to guest accounts in this channel',
    },
    memberLabel: {
        id: 'channel_settings.permissions_policy.role.channel_user',
        defaultMessage: 'Channel member',
    },
    memberDescription: {
        id: 'channel_settings.permissions_policy.role.channel_user.description',
        defaultMessage: 'Applies to regular channel members. Channel admins fall back to this rule when no admin-specific rule exists.',
    },
    adminLabel: {
        id: 'channel_settings.permissions_policy.role.channel_admin',
        defaultMessage: 'Channel admin',
    },
    adminDescription: {
        id: 'channel_settings.permissions_policy.role.channel_admin.description',
        defaultMessage: 'Applies only to channel administrators',
    },
    selectRole: {
        id: 'channel_settings.permissions_policy.role.select',
        defaultMessage: 'Select a role',
    },
});

const actionMessages = defineMessages({
    uploadLabel: {
        id: 'channel_settings.permissions_policy.action.upload',
        defaultMessage: 'Upload files',
    },
    uploadDescription: {
        id: 'channel_settings.permissions_policy.action.upload.description',
        defaultMessage: 'Allow users to attach files to messages in this channel',
    },
    downloadLabel: {
        id: 'channel_settings.permissions_policy.action.download',
        defaultMessage: 'Download files',
    },
    downloadDescription: {
        id: 'channel_settings.permissions_policy.action.download.description',
        defaultMessage: 'Allow users to download attached files from this channel',
    },
});

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

const AVAILABLE_ROLES: RoleDefinition[] = [
    {value: ACCESS_CONTROL_CHANNEL_ROLE_GUEST, label: roleMessages.guestLabel, description: roleMessages.guestDescription},
    {value: ACCESS_CONTROL_CHANNEL_ROLE_USER, label: roleMessages.memberLabel, description: roleMessages.memberDescription},
    {value: ACCESS_CONTROL_CHANNEL_ROLE_ADMIN, label: roleMessages.adminLabel, description: roleMessages.adminDescription},
];

const AVAILABLE_PERMISSIONS: PermissionDefinition[] = [
    {value: ACCESS_CONTROL_ACTION_UPLOAD_FILE, label: actionMessages.uploadLabel, description: actionMessages.uploadDescription},
    {value: ACCESS_CONTROL_ACTION_DOWNLOAD_FILE, label: actionMessages.downloadLabel, description: actionMessages.downloadDescription},
];

const ACTION_LABEL_IDS: Record<string, MessageDescriptor> = {
    [ACCESS_CONTROL_ACTION_UPLOAD_FILE]: actionMessages.uploadLabel,
    [ACCESS_CONTROL_ACTION_DOWNLOAD_FILE]: actionMessages.downloadLabel,
};

type EditableRule = {

    /** Stable identifier (within the lifetime of this tab instance) so the
     *  React key is stable while the user edits. */
    key: string;
    name: string;
    role: string;
    actions: string[];
    expression: string;
};

let RULE_KEY_COUNTER = 0;
const nextRuleKey = () => `rule-${++RULE_KEY_COUNTER}`;

function toEditable(rule: AccessControlPolicyRule): EditableRule {
    return {
        key: nextRuleKey(),
        name: rule.name || '',
        role: rule.role || ACCESS_CONTROL_CHANNEL_ROLE_USER,
        actions: (rule.actions || []).filter((a) => ACCESS_CONTROL_PERMISSION_ACTIONS.includes(a)),
        expression: rule.expression || '',
    };
}

function fromEditable(rule: EditableRule): AccessControlPolicyRule {
    return {
        name: rule.name.trim(),
        role: rule.role,
        actions: [...rule.actions],
        expression: rule.expression.trim(),
    };
}

function ChannelSettingsPermissionsPolicyTab({
    channel,
    setAreThereUnsavedChanges,
    showTabSwitchError,
}: ChannelSettingsPermissionsPolicyTabProps) {
    const {formatMessage} = useIntl();
    const accessControlSettings = useSelector((state: GlobalState) => getAccessControlSettings(state));
    const isSystemAdmin = useSelector(isCurrentUserSystemAdmin);
    const sessionAttributesEnabled = useSelector((state: GlobalState) => getFeatureFlagValue(state, 'SessionAttributes') === 'true');

    // Gate the "Simulate rules" button + modal. The
    // /cel/simulate_users endpoint returns 501 when this is off, so
    // hiding the UI here keeps the author from clicking a button
    // that would only surface a backend error.
    const policySimulationEnabled = useSelector(isPolicySimulationEnabled);

    const actions = useChannelAccessControlActions(channel.id);
    const {policies: systemPolicies} = useChannelSystemPolicies(channel);

    // The full set of rules from the loaded policy, used to preserve the
    // membership rule (and any future non-permission rules) on save.
    const [originalAllRules, setOriginalAllRules] = useState<AccessControlPolicyRule[]>([]);
    const [originalMembershipExpression, setOriginalMembershipExpression] = useState('');
    const [originalImports, setOriginalImports] = useState<string[]>([]);
    const [originalActive, setOriginalActive] = useState<boolean>(false);

    const [rules, setRules] = useState<EditableRule[]>([]);
    const [originalRulesJSON, setOriginalRulesJSON] = useState<string>('[]');

    const [userAttributes, setUserAttributes] = useState<UserPropertyField[]>([]);
    const [attributesLoaded, setAttributesLoaded] = useState(false);

    // The CEL autocomplete endpoint returns access control group attributes
    // and does not return session attributes, so fetch
    // the enabled ones separately and merge them into the picker.
    const sessionFields = useEnabledSessionAttributeFields(sessionAttributesEnabled);
    const mergedAttributes = useMemo(
        () => mergeSessionAttributes(userAttributes, sessionFields),
        [userAttributes, sessionFields],
    );

    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();
    const [formError, setFormError] = useState<string>('');

    // Load-error state: distinct from `formError` (which surfaces save
    // failures). Set when the initial getChannelPolicy fetch fails for
    // a reason other than 404 (e.g., network blip, 5xx, transient
    // permission flicker). Prevents the editor from rendering at all
    // so a user can't unintentionally save an empty `rules` state on
    // top of an existing policy that just couldn't be loaded —
    // wiping it. 404 explicitly seeds empty defaults instead, since
    // that's the legitimate "first-time create" path.
    const [loadError, setLoadError] = useState<string>('');

    // List view UX state.
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(0);

    // Editor state: when set, render the rule editor instead of the list.
    // `editingKey === '__new__'` represents an unsaved draft for a brand-new rule.
    const [editingKey, setEditingKey] = useState<string | null>(null);

    // Load user attributes on mount (TableEditor needs the field metadata).
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const result = await actions.getAccessControlFields('', 100);
                if (cancelled) {
                    return;
                }
                if (result.data) {
                    setUserAttributes(result.data);
                }
                setAttributesLoaded(true);
            } catch {
                if (cancelled) {
                    return;
                }
                setUserAttributes([]);

                // Always flip `attributesLoaded` on the error path
                // regardless of error type. This effect drives the
                // editor's "loading attributes…" gate; previously we
                // only flipped on 403 / Forbidden, which left the
                // editor stuck on every other failure mode (network
                // errors, 5xx, license-related 5xx wrappers, etc.).
                // Falling through to an empty-attribute editor is
                // strictly better than wedging it: TableEditor still
                // renders, just without the optional attribute
                // metadata that adds nice-to-have suggestions.
                setAttributesLoaded(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [actions]);

    // Load existing channel policy and seed permission rules state.
    //
    // bindClientFunc never throws; failures arrive on `result.error`
    // with a `status_code`. We split three cases:
    //
    //   1. Success (`result.data`) — seed every original/* state from
    //      the loaded policy.
    //   2. 404 — there is no persisted policy yet, which is the
    //      legitimate first-time-create path. Seed the same empty
    //      defaults the component already starts with so the save
    //      flow can POST a new policy.
    //   3. Anything else — set `loadError` so the render path can
    //      replace the editor with a banner. We deliberately do NOT
    //      reset originals/rules/originalRulesJSON in this case: a
    //      transient error must not leave the editor in a state
    //      where a save would wipe an existing policy that simply
    //      couldn't be fetched.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const result = await actions.getChannelPolicy(channel.id);
            if (cancelled) {
                return;
            }
            if (result.data) {
                const allRules = result.data.rules || [];
                const permissionRules = getPermissionRules(allRules);
                const editable = permissionRules.map(toEditable);
                setOriginalAllRules(allRules);
                setOriginalMembershipExpression(getMembershipRule(allRules)?.expression || '');
                setOriginalImports(result.data.imports || []);
                setOriginalActive(Boolean(result.data.active));
                setRules(editable);
                setOriginalRulesJSON(JSON.stringify(editable.map(fromEditable)));
                setLoadError('');
                return;
            }
            const err = result.error as {status_code?: number; message?: string} | undefined;
            if (err?.status_code === 404) {
                // First-time create: no policy yet. Seed empty
                // defaults so save POSTs a fresh policy.
                setOriginalAllRules([]);
                setOriginalMembershipExpression('');
                setOriginalImports([]);
                setOriginalActive(false);
                setRules([]);
                setOriginalRulesJSON('[]');
                setLoadError('');
                return;
            }
            setLoadError(err?.message || formatMessage({
                id: 'channel_settings.permissions_policy.load_error',
                defaultMessage: 'Failed to load this channel\'s permission policy. Try closing and reopening the channel settings.',
            }));
        })();
        return () => {
            cancelled = true;
        };
    }, [channel.id, actions, formatMessage]);

    // Notify parent of unsaved-state changes so the modal can guard tab switches.
    useEffect(() => {
        const current = JSON.stringify(rules.map(fromEditable));
        setAreThereUnsavedChanges?.(current !== originalRulesJSON || editingKey !== null);
    }, [rules, originalRulesJSON, editingKey, setAreThereUnsavedChanges]);

    // Recover from a stale editingKey: if the editor is open against a rule
    // that no longer exists (e.g. the policy was reloaded from the server and
    // a draft key was lost), drop back to the list view. Doing this in an
    // effect — rather than calling setEditingKey from render — avoids the
    // React "Cannot update a component while rendering" anti-pattern.
    useEffect(() => {
        if (editingKey === null || editingKey === '__new__') {
            return;
        }
        if (!rules.some((r) => r.key === editingKey)) {
            setEditingKey(null);
        }
    }, [editingKey, rules]);

    const showOrHint = useMemo(() => hasOverlappingPermissionRules(rules.map(fromEditable)), [rules]);

    // ── List filtering & pagination ───────────────────────────────────────
    const filteredRules = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) {
            return rules;
        }
        return rules.filter((r) => {
            if (r.name.toLowerCase().includes(q)) {
                return true;
            }
            const actionLabels = (r.actions || []).
                map((a) => (ACTION_LABEL_IDS[a] ? formatMessage(ACTION_LABEL_IDS[a]) : a).toLowerCase());
            return actionLabels.some((label) => label.includes(q));
        });
    }, [rules, searchTerm, formatMessage]);

    const totalPages = Math.max(1, Math.ceil(filteredRules.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const pageStart = safePage * PAGE_SIZE;
    const pageEnd = Math.min(pageStart + PAGE_SIZE, filteredRules.length);
    const pagedRules = filteredRules.slice(pageStart, pageEnd);

    useEffect(() => {
        // Snap back to page 0 if a search shrinks the result set below the
        // current page.
        if (page > 0 && page > totalPages - 1) {
            setPage(0);
        }
    }, [page, totalPages]);

    // ── Editor commit/cancel/draft helpers ────────────────────────────────
    const startNew = useCallback(() => {
        setEditingKey('__new__');
        setFormError('');
        setSaveChangesPanelState(undefined);
    }, []);

    const startEdit = useCallback((key: string) => {
        setEditingKey(key);
        setFormError('');
        setSaveChangesPanelState(undefined);
    }, []);

    const cancelEditor = useCallback(() => {
        setEditingKey(null);
        setFormError('');
    }, []);

    const deleteRule = useCallback((key: string) => {
        setRules((prev) => prev.filter((r) => r.key !== key));
        setSaveChangesPanelState(undefined);
        setFormError('');
    }, []);

    const validateDraft = useCallback((draft: EditableRule, isNew: boolean): string => {
        const trimmedName = draft.name.trim();
        if (!trimmedName) {
            return formatMessage({
                id: 'channel_settings.permissions_policy.error.name_required',
                defaultMessage: 'Each permission rule needs a unique name.',
            });
        }
        const conflicting = rules.some((r) => r.name.trim() === trimmedName && (isNew || r.key !== draft.key));
        if (conflicting) {
            return formatMessage(
                {
                    id: 'channel_settings.permissions_policy.error.name_unique',
                    defaultMessage: 'Rule name "{name}" is used more than once. Names must be unique within this channel.',
                },
                {name: trimmedName},
            );
        }
        if (draft.actions.length === 0) {
            return formatMessage({
                id: 'channel_settings.permissions_policy.error.actions_required',
                defaultMessage: 'Select at least one permission action for each rule.',
            });
        }
        if (!draft.expression.trim()) {
            return formatMessage({
                id: 'channel_settings.permissions_policy.error.expression_required',
                defaultMessage: 'Each rule needs an attribute expression.',
            });
        }
        return '';
    }, [rules, formatMessage]);

    const commitDraft = useCallback((draft: EditableRule, isNew: boolean) => {
        const validationError = validateDraft(draft, isNew);
        if (validationError) {
            setFormError(validationError);
            return false;
        }

        const sanitized: EditableRule = {
            ...draft,
            name: draft.name.trim(),
            expression: draft.expression.trim(),
        };

        setRules((prev) => {
            if (isNew) {
                return [...prev, {...sanitized, key: nextRuleKey()}];
            }
            return prev.map((r) => (r.key === sanitized.key ? sanitized : r));
        });
        setEditingKey(null);
        setFormError('');
        setSaveChangesPanelState(undefined);
        return true;
    }, [validateDraft]);

    // ── Simulation: build the synthetic draft sent to /cel/simulate ──────
    //
    // The editor's Test button needs to preview how the rule being authored
    // would interact with persisted higher-scoped policies. The simulator
    // expects a complete AccessControlPolicy, so we splice the in-progress
    // draft rule into the channel's existing rules (preserving membership
    // and any sibling permission rules untouched) and stamp it as v0.4 so
    // the backend dispatches the right validators.
    const buildSimulationPolicy = useCallback((draftRule: EditableRule): AccessControlPolicy => {
        const otherRules = rules.
            filter((r) => r.key !== draftRule.key).
            map(fromEditable);
        const draftAsRule = fromEditable(draftRule);

        // Preserve the existing membership rule (and any non-permission
        // entries the backend may have added) so the simulator sees a
        // coherent draft.
        const baseRules = buildRulesWithMembership(originalAllRules, originalMembershipExpression);
        const finalRules = buildRulesWithPermissionRules(baseRules, [...otherRules, draftAsRule]);

        return {
            id: channel.id,
            name: channel.display_name,
            type: 'channel',
            version: ACCESS_CONTROL_POLICY_VERSION_V0_4,
            revision: 0,
            rules: finalRules,
            imports: originalImports,
        };
    }, [rules, originalAllRules, originalMembershipExpression, originalImports, channel.id, channel.display_name]);

    // ── Persist to backend ────────────────────────────────────────────────
    const persistRules = useCallback(async (next: EditableRule[]): Promise<SaveResult> => {
        const persistedPermissionRules = next.map(fromEditable);
        const rulesWithMembership = buildRulesWithMembership(originalAllRules, originalMembershipExpression);
        const finalRules = buildRulesWithPermissionRules(rulesWithMembership, persistedPermissionRules);

        const policy = {
            id: channel.id,
            name: channel.display_name,
            type: 'channel',

            // Pin the schema version: v0.4 is the only version that
            // accepts per-role permission rules. Without this the
            // server's defaulting could pick an older version, the
            // permission rules would fail validation, and the save
            // would silently drop them.
            version: ACCESS_CONTROL_POLICY_VERSION_V0_4,

            // Active flag is owned by the Membership Policy tab; pass through
            // whatever value the loaded policy had so saving permission rules
            // never silently changes membership auto-sync state.
            active: originalActive,
            revision: 1,
            created_at: Date.now(),
            rules: finalRules,
            imports: originalImports,
        };

        try {
            const result = await actions.saveChannelPolicy(policy as any);
            if (result.error) {
                setFormError(result.error.message || formatMessage({
                    id: 'channel_settings.permissions_policy.save_error',
                    defaultMessage: 'Failed to save permission rules',
                }));
                return SAVE_RESULT_ERROR;
            }

            const savedAllRules = (result.data as any)?.rules ?? finalRules;
            setOriginalAllRules(savedAllRules);
            setOriginalRulesJSON(JSON.stringify(persistedPermissionRules));
            return SAVE_RESULT_SAVED;
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            setFormError(message || formatMessage({
                id: 'channel_settings.permissions_policy.save_error',
                defaultMessage: 'Failed to save permission rules',
            }));
            return SAVE_RESULT_ERROR;
        }
    }, [actions, originalAllRules, originalMembershipExpression, originalImports, originalActive, channel.id, channel.display_name, formatMessage]);

    const handleSaveChanges = useCallback(async () => {
        const result = await persistRules(rules);
        setSaveChangesPanelState(result);
    }, [persistRules, rules]);

    const handleCancel = useCallback(() => {
        try {
            const restored = (JSON.parse(originalRulesJSON) as AccessControlPolicyRule[]).map(toEditable);
            setRules(restored);
        } catch {
            setRules([]);
        }
        setFormError('');
        setSaveChangesPanelState(undefined);
        setEditingKey(null);
    }, [originalRulesJSON]);

    const handleClose = useCallback(() => {
        setSaveChangesPanelState(undefined);
    }, []);

    const hasUnsavedChanges = useMemo(() => {
        return JSON.stringify(rules.map(fromEditable)) !== originalRulesJSON;
    }, [rules, originalRulesJSON]);

    const hasErrors = Boolean(formError) || Boolean(showTabSwitchError);
    const shouldShowPanel = (hasUnsavedChanges || saveChangesPanelState === SAVE_RESULT_SAVED) && editingKey === null;

    // ── Render: load error (defensive — replaces both list and editor) ───
    // Block all editing affordances when the initial policy load failed
    // for a reason other than 404. Falling through to the regular
    // editor would let an author save an empty `rules` state on top of
    // an existing policy that simply couldn't be fetched.
    if (loadError) {
        return (
            <div
                className='ChannelSettingsModal__permissionsPolicyTab'
                data-testid='permissions-policy-load-error'
            >
                <div
                    className='ChannelSettingsModal__permissionsPolicyError'
                    role='alert'
                >
                    {loadError}
                </div>
            </div>
        );
    }

    // ── Render: editor view ───────────────────────────────────────────────
    if (editingKey !== null) {
        const isNew = editingKey === '__new__';
        const initial = isNew ? {
            key: '__new__',
            name: '',
            role: ACCESS_CONTROL_CHANNEL_ROLE_USER,
            actions: [],
            expression: '',
        } : rules.find((r) => r.key === editingKey);

        // Stale editingKey: render nothing for one tick — the recovery effect
        // above will reset editingKey and the list view will paint on the
        // next render. This avoids calling setEditingKey from render.
        if (!initial) {
            return null;
        }

        return (
            <PermissionRuleEditor
                key={editingKey}
                initial={initial}
                isNew={isNew}
                channelId={channel.id}
                actions={actions}
                userAttributes={mergedAttributes}
                attributesLoaded={attributesLoaded}
                enableUserManagedAttributes={accessControlSettings?.EnableUserManagedAttributes || false}
                isSystemAdmin={isSystemAdmin}
                error={formError}
                onCancel={cancelEditor}
                onCommit={commitDraft}
                buildSimulationPolicy={buildSimulationPolicy}
                policySimulationEnabled={policySimulationEnabled}
            />
        );
    }

    // ── Render: list view ────────────────────────────────────────────────
    return (
        <div className='ChannelSettingsModal__permissionsPolicyTab'>
            {/* One-line system-policy banner: signal that policies defined
              * higher up may also influence file action decisions. */}
            {systemPolicies.length > 0 && (
                <div
                    className='ChannelSettingsModal__permissionsPolicyBanner'
                    data-testid='permissions-policy-system-banner'
                >
                    <i className='icon icon-information-outline'/>
                    <span>
                        <FormattedMessage
                            id='channel_settings.permissions_policy.system_banner'
                            defaultMessage='System-wide permission policies may also influence access decisions for this channel.'
                        />
                    </span>
                </div>
            )}

            <div className='ChannelSettingsModal__permissionsPolicyHeader'>
                <h3 className='ChannelSettingsModal__permissionsPolicyTitle'>
                    <FormattedMessage
                        id='channel_settings.permissions_policy.section_title'
                        defaultMessage='Channel permission rules'
                    />
                </h3>
                <Button
                    className='ChannelSettingsModal__permissionsPolicyAddRule'
                    onClick={startNew}
                    disabled={!attributesLoaded}
                    data-testid='permissions-policy-add-rule'
                >
                    <i className='icon icon-plus'/>
                    <FormattedMessage
                        id='channel_settings.permissions_policy.add_rule'
                        defaultMessage='Add rule'
                    />
                </Button>
            </div>

            <div className='ChannelSettingsModal__permissionsPolicySearch'>
                <i className='icon icon-magnify'/>
                <input
                    type='text'
                    className='form-control'
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setPage(0);
                    }}
                    placeholder={formatMessage({
                        id: 'channel_settings.permissions_policy.search_placeholder',
                        defaultMessage: 'Search by name or permission',
                    })}

                    // The placeholder disappears on focus, so back the input
                    // with an accessible name that screen readers announce
                    // independently of the visible placeholder text.
                    aria-label={formatMessage({
                        id: 'channel_settings.permissions_policy.search_aria',
                        defaultMessage: 'Search permission rules by name or permission',
                    })}
                    data-testid='permissions-policy-search'
                />
            </div>

            {showOrHint && (
                <div
                    className='ChannelSettingsModal__permissionsPolicyOrHint'
                    data-testid='permissions-or-hint'
                >
                    <i className='icon icon-information-outline'/>
                    <FormattedMessage
                        id='channel_settings.permissions_policy.or_hint'
                        defaultMessage='When several rules apply to the same role and action, a user is allowed if any one of them allows them. A system-level policy may still deny the permission even when this channel policy allows it.'
                    />
                </div>
            )}

            <table
                className='ChannelSettingsModal__permissionsPolicyTable'
                data-testid='permissions-policy-rules-table'
            >
                <thead>
                    <tr>
                        <th>
                            <FormattedMessage
                                id='channel_settings.permissions_policy.column.name'
                                defaultMessage='Name'
                            />
                        </th>
                        <th>
                            <FormattedMessage
                                id='channel_settings.permissions_policy.column.permissions'
                                defaultMessage='Permissions'
                            />
                        </th>
                        <th aria-label='row-controls'/>
                    </tr>
                </thead>
                <tbody>
                    {pagedRules.length === 0 ? (
                        <tr className='ChannelSettingsModal__permissionsPolicyEmpty'>
                            <td colSpan={3}>
                                {searchTerm ? (
                                    <FormattedMessage
                                        id='channel_settings.permissions_policy.empty_search'
                                        defaultMessage='No rules match your search.'
                                    />
                                ) : (
                                    <FormattedMessage
                                        id='channel_settings.permissions_policy.empty'
                                        defaultMessage='No permission rules yet. Click "Add rule" to create one.'
                                    />
                                )}
                            </td>
                        </tr>
                    ) : (
                        pagedRules.map((rule) => {
                            const permissionCount = (rule.actions || []).length;
                            return (
                                <tr
                                    key={rule.key}
                                    data-testid={`permissions-policy-row-${rule.key}`}
                                    className='ChannelSettingsModal__permissionsPolicyRow'
                                    onClick={() => startEdit(rule.key)}
                                >
                                    <td className='ChannelSettingsModal__permissionsPolicyRowName'>
                                        {rule.name || (
                                            <span className='ChannelSettingsModal__permissionsPolicyRowNamePlaceholder'>
                                                <FormattedMessage
                                                    id='channel_settings.permissions_policy.row.unnamed'
                                                    defaultMessage='(unnamed rule)'
                                                />
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <FormattedMessage
                                            id='channel_settings.permissions_policy.row.permissions_count'
                                            defaultMessage='{count, plural, one {# permission} other {# permissions}}'
                                            values={{count: permissionCount}}
                                        />
                                    </td>
                                    <td
                                        className='ChannelSettingsModal__permissionsPolicyRowControls'
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Menu.Container
                                            menuButton={{
                                                id: `permissions-policy-row-menu-${rule.key}`,
                                                'aria-label': formatMessage({
                                                    id: 'channel_settings.permissions_policy.row.menu_label',
                                                    defaultMessage: 'Rule actions',
                                                }),
                                                class: 'ChannelSettingsModal__permissionsPolicyRowMenuButton',
                                                children: <i className='icon icon-dots-horizontal'/>,
                                            }}
                                            menu={{
                                                id: `permissions-policy-row-menu-${rule.key}-content`,
                                            }}
                                        >
                                            <Menu.Item
                                                key='edit'
                                                id={`permissions-policy-row-edit-${rule.key}`}
                                                onClick={() => startEdit(rule.key)}
                                                labels={(
                                                    <FormattedMessage
                                                        id='channel_settings.permissions_policy.row.edit'
                                                        defaultMessage='Edit'
                                                    />
                                                )}
                                                leadingElement={<i className='icon icon-pencil-outline'/>}
                                            />
                                            <Menu.Item
                                                key='delete'
                                                id={`permissions-policy-row-delete-${rule.key}`}
                                                onClick={() => deleteRule(rule.key)}
                                                isDestructive={true}
                                                labels={(
                                                    <FormattedMessage
                                                        id='channel_settings.permissions_policy.row.delete'
                                                        defaultMessage='Delete'
                                                    />
                                                )}
                                                leadingElement={<i className='icon icon-trash-can-outline'/>}
                                            />
                                        </Menu.Container>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>

            {filteredRules.length > 0 && (
                <div className='ChannelSettingsModal__permissionsPolicyPagination'>
                    <span>
                        <FormattedMessage
                            id='channel_settings.permissions_policy.pagination.range'
                            defaultMessage='{start} - {end} of {total}'
                            values={{
                                start: filteredRules.length === 0 ? 0 : pageStart + 1,
                                end: pageEnd,
                                total: filteredRules.length,
                            }}
                        />
                    </span>
                    <button
                        type='button'
                        className='btn btn-tertiary'
                        onClick={() => setPage(Math.max(0, safePage - 1))}
                        disabled={safePage === 0}
                        aria-label={formatMessage({
                            id: 'channel_settings.permissions_policy.pagination.previous',
                            defaultMessage: 'Previous page',
                        })}
                    >
                        <i className='icon icon-chevron-left'/>
                    </button>
                    <button
                        type='button'
                        className='btn btn-tertiary'
                        onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
                        disabled={safePage >= totalPages - 1}
                        aria-label={formatMessage({
                            id: 'channel_settings.permissions_policy.pagination.next',
                            defaultMessage: 'Next page',
                        })}
                    >
                        <i className='icon icon-chevron-right'/>
                    </button>
                </div>
            )}

            {shouldShowPanel && (
                <SaveChangesPanel
                    handleSubmit={handleSaveChanges}
                    handleCancel={handleCancel}
                    handleClose={handleClose}
                    tabChangeError={hasErrors}
                    state={hasErrors ? SAVE_RESULT_ERROR : saveChangesPanelState}
                    customErrorMessage={formError || (showTabSwitchError ? undefined : formatMessage({
                        id: 'channel_settings.permissions_policy.form_error',
                        defaultMessage: 'There are errors in the form above',
                    }))}
                    cancelButtonText={formatMessage({
                        id: 'channel_settings.save_changes_panel.reset',
                        defaultMessage: 'Reset',
                    })}
                />
            )}
        </div>
    );
}

type PermissionRuleEditorProps = {
    initial: EditableRule;
    isNew: boolean;
    channelId: string;
    actions: ReturnType<typeof useChannelAccessControlActions>;
    userAttributes: UserPropertyField[];
    attributesLoaded: boolean;
    enableUserManagedAttributes: boolean;
    isSystemAdmin: boolean;
    error: string;
    onCancel: () => void;
    onCommit: (draft: EditableRule, isNew: boolean) => boolean;

    /**
     * Builds the synthetic draft policy used by the per-rule simulation. The
     * parent owns this because it has the full rules list (membership +
     * sibling permission rules) needed for blame attribution. The returned
     * policy is sent to the simulate endpoint as-is.
     */
    buildSimulationPolicy: (draft: EditableRule) => AccessControlPolicy;

    /**
     * Whether the policy-simulation sub-feature is enabled. When
     * false the "Simulate rules" button and modal are suppressed —
     * the /cel/simulate_users endpoint returns 501 in that case so
     * the modal would only ever surface a backend error.
     */
    policySimulationEnabled: boolean;
};

function PermissionRuleEditor({
    initial,
    isNew,
    channelId,
    actions,
    userAttributes,
    attributesLoaded,
    enableUserManagedAttributes,
    isSystemAdmin,
    error,
    onCancel,
    onCommit,
    buildSimulationPolicy,
    policySimulationEnabled,
}: PermissionRuleEditorProps) {
    const {formatMessage} = useIntl();

    // Seed once on mount. The parent passes a stable `key` so switching
    // rules remounts and re-seeds here. Re-seeding from an effect keyed on
    // `initial` instead would wipe in-progress edits on any parent re-render
    // that rebuilds `initial` (e.g. surfacing a validation error on save).
    const [draft, setDraft] = useState<EditableRule>(initial);
    const [showTest, setShowTest] = useState(false);

    const actionLabels = useMemo(() => {
        const labels: Record<string, string> = {};
        for (const def of AVAILABLE_PERMISSIONS) {
            labels[def.value] = formatMessage(def.label);
        }
        return labels;
    }, [formatMessage]);

    const update = useCallback((patch: Partial<EditableRule>) => {
        setDraft((prev) => ({...prev, ...patch}));
    }, []);

    const addPermission = useCallback((action: string) => {
        setDraft((prev) => (prev.actions.includes(action) ? prev : {...prev, actions: [...prev.actions, action]}));
    }, []);

    const removePermission = useCallback((action: string) => {
        setDraft((prev) => ({...prev, actions: prev.actions.filter((a) => a !== action)}));
    }, []);

    const selectedRoleDef = AVAILABLE_ROLES.find((r) => r.value === draft.role);
    const availableToAdd = AVAILABLE_PERMISSIONS.filter((p) => !draft.actions.includes(p.value));

    return (
        <div
            className='ChannelSettingsModal__permissionsPolicyEditor'
            data-testid='permissions-policy-editor'
        >
            <div className='ChannelSettingsModal__permissionsPolicyEditorHeader'>
                <button
                    type='button'
                    className='ChannelSettingsModal__permissionsPolicyEditorBack'
                    onClick={onCancel}
                    aria-label={formatMessage({
                        id: 'channel_settings.permissions_policy.editor.back',
                        defaultMessage: 'Back to rules list',
                    })}
                >
                    <i className='icon icon-chevron-left'/>
                </button>
                <h3>
                    {isNew ? (
                        <FormattedMessage
                            id='channel_settings.permissions_policy.editor.add_title'
                            defaultMessage='Add permission rule'
                        />
                    ) : (
                        <FormattedMessage
                            id='channel_settings.permissions_policy.editor.edit_title'
                            defaultMessage='Edit permission rule'
                        />
                    )}
                </h3>
            </div>

            <div className='ChannelSettingsModal__permissionsPolicyEditorFields'>
                <label className='ChannelSettingsModal__permissionsPolicyField'>
                    <span className='ChannelSettingsModal__permissionsPolicyFieldLabel'>
                        <FormattedMessage
                            id='channel_settings.permissions_policy.field.name'
                            defaultMessage='Name'
                        />
                    </span>
                    <input
                        type='text'
                        className='form-control'
                        value={draft.name}
                        onChange={(e) => update({name: e.target.value})}
                        maxLength={128}
                        placeholder={formatMessage({
                            id: 'channel_settings.permissions_policy.field.name_placeholder',
                            defaultMessage: 'e.g. Block external uploads',
                        })}
                        data-testid='permissions-policy-editor-name'
                    />
                </label>

                <div className='ChannelSettingsModal__permissionsPolicyField'>
                    <span className='ChannelSettingsModal__permissionsPolicyFieldLabel'>
                        <FormattedMessage
                            id='channel_settings.permissions_policy.field.role'
                            defaultMessage='Role'
                        />
                    </span>
                    <span className='ChannelSettingsModal__permissionsPolicyFieldHint'>
                        <FormattedMessage
                            id='channel_settings.permissions_policy.field.role_hint'
                            defaultMessage='Channel-scoped role this rule applies to'
                        />
                    </span>
                    <Menu.Container
                        menuButton={{
                            id: 'cpp-role-selector-btn',
                            class: 'ChannelSettingsModal__permissionsPolicyDropdownButton',
                            dataTestId: 'permissions-policy-editor-role',
                            children: (
                                <>
                                    <span>
                                        {selectedRoleDef ? formatMessage(selectedRoleDef.label) : formatMessage(roleMessages.selectRole)}
                                    </span>
                                    <i className='icon icon-chevron-down'/>
                                </>
                            ),
                        }}
                        menu={{
                            id: 'cpp-role-selector-menu',
                            'aria-label': formatMessage({
                                id: 'channel_settings.permissions_policy.field.role_menu_aria',
                                defaultMessage: 'Role selection menu',
                            }),
                        }}
                    >
                        {AVAILABLE_ROLES.map((role) => (
                            <Menu.Item
                                key={role.value}
                                id={`cpp-role-option-${role.value}`}
                                onClick={() => update({role: role.value})}
                                labels={(
                                    <>
                                        <span>{formatMessage(role.label)}</span>
                                        <span>{formatMessage(role.description)}</span>
                                    </>
                                )}
                                trailingElements={draft.role === role.value ? <i className='icon icon-check'/> : undefined}
                            />
                        ))}
                    </Menu.Container>
                </div>

                <div
                    className='ChannelSettingsModal__permissionsPolicyExpression'
                    data-testid='permissions-policy-editor-expression-section'
                >
                    <span className='ChannelSettingsModal__permissionsPolicyFieldLabel'>
                        <FormattedMessage
                            id='channel_settings.permissions_policy.field.expression'
                            defaultMessage='User attribute conditions'
                        />
                    </span>
                    {attributesLoaded && (
                        <TableEditor
                            value={draft.expression}
                            onChange={(next) => update({expression: next})}
                            onValidate={() => undefined}
                            userAttributes={userAttributes}
                            onParseError={() => undefined}
                            channelId={channelId}
                            actions={actions}
                            enableUserManagedAttributes={enableUserManagedAttributes}
                            isSystemAdmin={isSystemAdmin}

                            // Replace the legacy expression-only test with the
                            // dual-lane simulation modal so the author can see
                            // how their rule interacts with system permission
                            // policies. Re-label "Test access rule" → "Simulate
                            // rules" to match the modal's full rule-set scope.
                            //
                            // When the PolicySimulation feature flag is off
                            // we stop passing the override entirely — the
                            // `onTestClick` slot is what swaps the built-in
                            // expression test for the dual-lane simulation,
                            // so falling back to undefined restores the
                            // editor's default "Test access rule" button
                            // (TestResultsModal). The test button itself is
                            // a separate, always-on feature; only the
                            // simulation override is gated.
                            onTestClick={policySimulationEnabled ? () => setShowTest(true) : undefined}
                            testButtonLabel={policySimulationEnabled ? (
                                <FormattedMessage
                                    id='admin.permission_policies.editor.simulate_rules'
                                    defaultMessage='Simulate rules'
                                />
                            ) : undefined}
                        />
                    )}
                </div>

                <div
                    className='ChannelSettingsModal__permissionsPolicyField'
                    data-testid='permissions-policy-editor-permissions-section'
                >
                    <span className='ChannelSettingsModal__permissionsPolicyFieldLabel'>
                        <FormattedMessage
                            id='channel_settings.permissions_policy.field.actions'
                            defaultMessage='Permissions'
                        />
                    </span>
                    <span className='ChannelSettingsModal__permissionsPolicyFieldHint'>
                        <FormattedMessage
                            id='channel_settings.permissions_policy.field.actions_hint'
                            defaultMessage='These permissions are governed by this rule'
                        />
                    </span>

                    <div className='ChannelSettingsModal__permissionsPolicyPermsTable'>
                        <div className='ChannelSettingsModal__permissionsPolicyPermsTableHeader'>
                            <FormattedMessage
                                id='channel_settings.permissions_policy.field.actions_column'
                                defaultMessage='Permission'
                            />
                        </div>
                        {draft.actions.length === 0 ? (
                            <div className='ChannelSettingsModal__permissionsPolicyPermsTableEmpty'>
                                <FormattedMessage
                                    id='channel_settings.permissions_policy.field.actions_empty'
                                    defaultMessage='Add a permission to this rule'
                                />
                            </div>
                        ) : (
                            draft.actions.map((permValue) => {
                                const permDef = AVAILABLE_PERMISSIONS.find((p) => p.value === permValue);
                                return (
                                    <div
                                        key={permValue}
                                        className='ChannelSettingsModal__permissionsPolicyPermsTableRow'
                                        data-testid={`permissions-policy-editor-action-${permValue}`}
                                    >
                                        <span className='ChannelSettingsModal__permissionsPolicyPermsTableLabel'>
                                            {permDef ? formatMessage(permDef.label) : permValue}
                                        </span>
                                        <button
                                            type='button'
                                            className='ChannelSettingsModal__permissionsPolicyPermsTableRemove'
                                            onClick={() => removePermission(permValue)}
                                            aria-label={formatMessage({
                                                id: 'channel_settings.permissions_policy.field.actions_remove',
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
                                id: 'cpp-add-permission-btn',
                                class: 'ChannelSettingsModal__permissionsPolicyAddPermissionButton',
                                dataTestId: 'permissions-policy-editor-add-permission',
                                children: (
                                    <>
                                        <i className='icon icon-plus'/>
                                        <FormattedMessage
                                            id='channel_settings.permissions_policy.field.actions_add'
                                            defaultMessage='Add permission'
                                        />
                                    </>
                                ),
                            }}
                            menu={{
                                id: 'cpp-add-permission-menu',
                                'aria-label': formatMessage({
                                    id: 'channel_settings.permissions_policy.field.actions_add_menu_aria',
                                    defaultMessage: 'Add permission menu',
                                }),
                            }}
                        >
                            {availableToAdd.map((perm) => (
                                <Menu.Item
                                    key={perm.value}
                                    id={`cpp-add-permission-${perm.value}`}
                                    onClick={() => addPermission(perm.value)}
                                    labels={(
                                        <>
                                            <span>{formatMessage(perm.label)}</span>
                                            <span>{formatMessage(perm.description)}</span>
                                        </>
                                    )}
                                />
                            ))}
                        </Menu.Container>
                    )}
                </div>
            </div>

            {error && (
                <div
                    className='ChannelSettingsModal__permissionsPolicyError'
                    data-testid='permissions-policy-editor-error'
                >
                    {error}
                </div>
            )}

            <div className='ChannelSettingsModal__permissionsPolicyEditorActions'>
                <Button
                    emphasis='tertiary'
                    onClick={onCancel}
                    data-testid='permissions-policy-editor-cancel'
                >
                    <FormattedMessage
                        id='channel_settings.permissions_policy.editor.cancel'
                        defaultMessage='Cancel'
                    />
                </Button>
                <Button
                    onClick={() => onCommit(draft, isNew)}
                    data-testid='permissions-policy-editor-save'
                >
                    {isNew ? (
                        <FormattedMessage
                            id='channel_settings.permissions_policy.editor.add'
                            defaultMessage='Add rule'
                        />
                    ) : (
                        <FormattedMessage
                            id='channel_settings.permissions_policy.editor.save'
                            defaultMessage='Save rule'
                        />
                    )}
                </Button>
            </div>

            {policySimulationEnabled && showTest && (
                <SimulateAccessModal
                    isStacked={true}
                    onExited={() => setShowTest(false)}
                    policy={buildSimulationPolicy(draft)}
                    actions={draft.actions}
                    ruleName={draft.name.trim()}
                    channelId={channelId}
                    actionLabels={actionLabels}
                    targetRole={draft.role}
                    targetScope='channel'
                    accessControlFields={userAttributes}
                />
            )}
        </div>
    );
}

export default ChannelSettingsPermissionsPolicyTab;
