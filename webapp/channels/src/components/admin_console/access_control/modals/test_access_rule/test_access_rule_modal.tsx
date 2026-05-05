// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    autoUpdate,
    flip,
    FloatingFocusManager,
    FloatingPortal,
    offset as floatingOffset,
    shift,
    useClick,
    useDismiss,
    useFloating,
    useInteractions,
    useRole,
} from '@floating-ui/react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {
    AccessControlPolicy,
    PolicySimulationActionDecision,
    PolicySimulationByUsersParams,
    PolicySimulationResponse,
    PolicySimulationUserOverride,
} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties';
import {SESSION_ATTRIBUTES_GROUP_ID} from '@mattermost/types/properties';
import type {UserProfile} from '@mattermost/types/users';

import {simulatePolicyForUsers} from 'mattermost-redux/actions/access_control';
import {searchProfiles} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import type {ActionResult} from 'mattermost-redux/types/actions';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import * as Menu from 'components/menu';
import ProfilePicture from 'components/profile_picture';
import Input from 'components/widgets/inputs/input/input';

import {aggregateDecisions} from './decision_aggregate';
import type {AggregateDecisionState} from './decision_aggregate';
import DecisionChip from './decision_chip';
import PermissionBreakdownModal from './permission_breakdown_modal';
import {channelRolesMatchingTarget, userMatchesTargetRole} from './role_applicability';
import type {TargetScope} from './role_applicability';

import './test_access_rule_modal.scss';

const SIMULATE_DEBOUNCE_MS = 300;
const USER_SEARCH_LIMIT = 20;

type Props = {
    onExited: () => void;
    isStacked?: boolean;

    /** Draft policy as it currently sits in the editor. Compiled in-memory
     *  on the server; never persisted. */
    policy: AccessControlPolicy;

    /** Selected permission actions for the rule. The picker only renders
     *  decisions for these actions. */
    actions: string[];

    /** Rule name used for blame attribution: denies originating from this
     *  rule are tagged source=this_rule. */
    ruleName?: string;

    /** Channel context for delegated channel-admin authorization. */
    channelId?: string;

    /** Team context for delegated team-admin authorization. */
    teamId?: string;

    /** Optional human-readable label map for action chip groups. Falls back
     *  to the raw action string when not provided. */
    actionLabels?: Record<string, string>;

    /** Role this rule targets. Used to pre-filter the user search so authors
     *  can only add users this rule could govern. Empty string disables the
     *  filter. */
    targetRole?: string;

    /** Scope to interpret targetRole in. 'system' uses the user's roles
     *  tokens; 'channel' uses channel-member role lookups (currently
     *  defaults to channel_user — full channel-member resolution lives in
     *  the picker host). */
    targetScope?: TargetScope;

    /** Access-control property fields the parent already fetched (mix of
     *  CPA + session attributes). The picker filters to the session
     *  attribute group to decide whether to expose session-related row
     *  controls. When empty/unset, the modal hides the "Use active
     *  session" checkbox + the "Configure session attributes" gear icon
     *  entirely — there's nothing meaningful to override yet. */
    accessControlFields?: UserPropertyField[];
};

type RowState = {
    user: UserProfile;
    useActiveSession: boolean;
    sessionOverrides: Record<string, string>;
};

/**
 * Picker-driven "Test access rule" modal. The author hand-picks specific
 * users — pre-filtered by role applicability so an admin-targeted rule
 * can't be tested against regular members — and sees per-user, per-action
 * ALLOW/DENY chips with blame attribution coming back from
 * /access_control_policies/cel/simulate_users.
 *
 * Per-row controls:
 *  - "Use active session" checkbox (forward-compat with future PDP wiring;
 *    today the snapshot is empty, so toggling has no effect on decisions
 *    until the live PDP populates session.* attributes).
 *  - Gear icon opens a stub "configure session attributes" panel. The
 *    backend session-overrides plumbing is fully shipped; this UI iteration
 *    keeps the panel as a placeholder so we can land the picker without
 *    blocking on attribute-form design.
 *  - X removes the row (and re-runs the simulator with the smaller set).
 *
 * Decisions are debounced 300ms after any state change to avoid thrash on
 * rapid toggle clicks. Pending state shows an "Evaluating…" chip so authors
 * never see a stale verdict.
 */
function TestAccessRuleModal({
    onExited,
    isStacked = false,
    policy,
    actions,
    ruleName,
    channelId,
    teamId,
    actionLabels,
    targetRole = '',
    targetScope = 'system',
    accessControlFields,
}: Props): JSX.Element {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const [rows, setRows] = useState<Map<string, RowState>>(() => new Map());
    const [decisions, setDecisions] = useState<Map<string, Record<string, PolicySimulationActionDecision>>>(() => new Map());
    const [pending, setPending] = useState<boolean>(false);

    // Session-attribute fields drive the conditional row controls (gear
    // icon + "Use active session" checkbox). When the deployment hasn't
    // configured any session attributes yet, the corresponding plumbing
    // would be a dead-end UX, so we hide the controls entirely.
    const sessionAttributesEnabled = useMemo(() => {
        if (!accessControlFields) {
            return false;
        }
        return accessControlFields.some((f) => f.group_id === SESSION_ATTRIBUTES_GROUP_ID);
    }, [accessControlFields]);

    // Track the latest simulate request so out-of-order responses don't
    // overwrite the current view (e.g. a slow first simulate finishing
    // after a faster second one).
    const requestSeq = useRef(0);

    const runSimulate = useCallback(async (rowList: RowState[]) => {
        if (rowList.length === 0 || actions.length === 0) {
            setDecisions(new Map());
            setPending(false);
            return;
        }

        setPending(true);
        const mySeq = ++requestSeq.current;

        const userOverrides: PolicySimulationUserOverride[] = rowList.map((r) => ({
            user_id: r.user.id,
            use_active_session: r.useActiveSession || undefined,
            session_overrides: Object.keys(r.sessionOverrides).length > 0 ? r.sessionOverrides : undefined,
        }));

        const params: PolicySimulationByUsersParams = {
            policy,
            actions,
            rule_name: ruleName,
            channel_id: channelId,
            team_id: teamId,
            users: userOverrides,
        };

        const result = await dispatch(simulatePolicyForUsers(params));
        if (mySeq !== requestSeq.current) {
            return;
        }

        const next = new Map<string, Record<string, PolicySimulationActionDecision>>();
        const data = (result as ActionResult<PolicySimulationResponse>).data;
        if (data) {
            for (const r of data.results) {
                if (r.user && r.decisions) {
                    next.set(r.user.id, r.decisions);
                }
            }
        }
        setDecisions(next);
        setPending(false);
    }, [actions, dispatch, policy, ruleName, channelId, teamId]);

    // Debounce simulate dispatches so dragging the "Use active session"
    // checkbox or quickly adding several rows doesn't flood the API.
    useEffect(() => {
        const rowList = Array.from(rows.values());
        const handle = window.setTimeout(() => {
            runSimulate(rowList);
        }, SIMULATE_DEBOUNCE_MS);
        return () => {
            window.clearTimeout(handle);
        };
    }, [rows, runSimulate]);

    const handleAddUser = useCallback((user: UserProfile) => {
        setRows((prev) => {
            if (prev.has(user.id)) {
                return prev;
            }
            const next = new Map(prev);
            next.set(user.id, {
                user,
                useActiveSession: false,
                sessionOverrides: {},
            });
            return next;
        });
    }, []);

    const handleRemoveUser = useCallback((userId: string) => {
        setRows((prev) => {
            if (!prev.has(userId)) {
                return prev;
            }
            const next = new Map(prev);
            next.delete(userId);
            return next;
        });
        setDecisions((prev) => {
            if (!prev.has(userId)) {
                return prev;
            }
            const next = new Map(prev);
            next.delete(userId);
            return next;
        });
    }, []);

    const handleToggleActiveSession = useCallback((userId: string) => {
        setRows((prev) => {
            const row = prev.get(userId);
            if (!row) {
                return prev;
            }
            const next = new Map(prev);
            next.set(userId, {...row, useActiveSession: !row.useActiveSession});
            return next;
        });
    }, []);

    return (
        <GenericModal
            className='TestAccessRuleModal a11y__modal'
            id='testAccessRuleModal'
            show={true}
            onHide={onExited}
            onExited={onExited}
            modalHeaderText={
                <FormattedMessage
                    id='admin.access_control.test_access_rule.title'
                    defaultMessage='Test access rule'
                />
            }
            showCloseButton={true}
            bodyPadding={false}
            compassDesign={true}
            ariaLabel={formatMessage({id: 'admin.access_control.test_access_rule.title', defaultMessage: 'Test access rule'})}
            isStacked={isStacked}

            // The user picker uses a FloatingPortal popover that lives in
            // <body>. Bootstrap's default focus trap would yank focus
            // back to the modal whenever the user tabs into the portal'd
            // search input, making it impossible to type. Letting the
            // floating-ui FloatingFocusManager own focus inside the
            // popover avoids that fight without breaking accessibility:
            // focus still returns to the trigger button when the
            // popover closes.
            enforceFocus={false}
        >
            <div className='TestAccessRuleModal__subheader'>
                <p>
                    <FormattedMessage
                        id='admin.access_control.test_access_rule.subtitle'
                        defaultMessage='Pick users to dry-run the access expression as the policy decision point would at request time.'
                    />
                </p>
                <AddUsersInline
                    onAdd={handleAddUser}
                    excludeIdsKey={Array.from(rows.keys()).sort().join(',')}
                    excludeIds={rows}
                    targetRole={targetRole}
                    targetScope={targetScope}
                    teamId={teamId}
                    channelId={channelId}
                />
            </div>

            <div className='TestAccessRuleModal__body'>
                {rows.size === 0 ? (
                    <div className='TestAccessRuleModal__empty'>
                        <FormattedMessage
                            id='admin.access_control.test_access_rule.empty_state'
                            defaultMessage='Pick users to dry-run the access expression as the policy decision point would at request time.'
                        />
                    </div>
                ) : (
                    <div className='TestAccessRuleModal__rows'>
                        {Array.from(rows.values()).map((row) => (
                            <PickerRow
                                key={row.user.id}
                                row={row}
                                actions={actions}
                                actionLabels={actionLabels}
                                pending={pending}
                                decisionsForUser={decisions.get(row.user.id)}
                                sessionAttributesEnabled={sessionAttributesEnabled}
                                onToggleActiveSession={handleToggleActiveSession}
                                onRemove={handleRemoveUser}
                            />
                        ))}
                    </div>
                )}
            </div>
        </GenericModal>
    );
}

type AddUsersInlineProps = {
    onAdd: (user: UserProfile) => void;

    /** A stable string key derived from the picker's current row IDs.
     *  Used as the effect dependency so the search debouncer doesn't get
     *  re-armed on every render (Array.from() yields a fresh reference
     *  each time, which would cancel the in-flight search). */
    excludeIdsKey: string;

    /** Live row map used to filter results — read at the moment a search
     *  resolves, not as an effect dependency. */
    excludeIds: Map<string, unknown>;
    targetRole: string;
    targetScope: TargetScope;
    teamId?: string;
    channelId?: string;
};

/**
 * Compact inline searcher: a custom controlled dropdown anchored on the
 * "+ Add users" button. Searches by username/email via searchProfiles and
 * filters results by role applicability so authors can't add users this
 * rule wouldn't govern.
 *
 * NB: we don't reuse Menu.Container here because Mui's menu intercepts
 * keyboard events for menu-item navigation, which makes the search input
 * un-typeable. Static menus (e.g. the gear-icon configure panel) work
 * fine with Menu.Container; this one needs an editable input.
 *
 * Channel-scope filtering is intentionally conservative right now: full
 * channel-membership resolution requires an extra round-trip the picker
 * doesn't make today, so the helper short-circuits to true for channel
 * scope. The server-side draftAppliesToSubject defence still rejects
 * inapplicable users by returning a "no_applicable_policy" blame.
 */
function AddUsersInline({onAdd, excludeIdsKey, excludeIds, targetRole, targetScope, teamId, channelId}: AddUsersInlineProps): JSX.Element {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const [term, setTerm] = useState('');
    const [results, setResults] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    // floating-ui keeps the popover anchored to the trigger button via
    // viewport-fixed positioning + autoUpdate, so it escapes the parent
    // modal's overflow clipping. The actual panel is rendered through
    // FloatingPortal at <body> level (above any stacked modal); useDismiss
    // wires the outside-click + Escape behavior.
    const {refs, floatingStyles, context} = useFloating({
        open,
        onOpenChange: setOpen,
        strategy: 'fixed',
        placement: 'bottom-end',
        whileElementsMounted: autoUpdate,
        middleware: [
            floatingOffset(6),
            flip({padding: 8}),
            shift({padding: 8}),
        ],
    });

    const {getReferenceProps, getFloatingProps} = useInteractions([
        useClick(context, {toggle: true}),
        useDismiss(context, {
            outsidePress: true,
            escapeKey: true,
        }),
        useRole(context, {role: 'dialog'}),
    ]);

    // Read the live exclude set inside the effect body (not as a dep) so
    // the debouncer doesn't get reset every time the parent re-renders
    // with a new Map reference.
    const excludeIdsRef = useRef(excludeIds);
    excludeIdsRef.current = excludeIds;

    useEffect(() => {
        if (!term) {
            setResults([]);
            return undefined;
        }

        let cancelled = false;
        setLoading(true);
        const handle = window.setTimeout(async () => {
            const opts: Record<string, any> = {limit: USER_SEARCH_LIMIT};
            if (teamId) {
                opts.team_id = teamId;
            }

            // Channel-scope picker: scope to channel members AND filter by
            // channel_roles so the server only returns subjects whose
            // membership role makes them governable by the draft rule
            // (e.g. testing a channel_admin rule excludes regular members
            // outright instead of letting the simulator round-trip a
            // "no_applicable_policy" blame for every member).
            if (targetScope === 'channel' && channelId) {
                opts.in_channel_id = channelId;
                const channelRoles = channelRolesMatchingTarget(targetRole);
                if (channelRoles.length > 0) {
                    opts.channel_roles = channelRoles;
                }
            }
            const action = await dispatch(searchProfiles(term, opts));
            if (cancelled) {
                return;
            }
            const found: UserProfile[] = (action as ActionResult<UserProfile[]>).data ?? [];
            const filtered = found.filter((u) => {
                if (excludeIdsRef.current.has(u.id)) {
                    return false;
                }
                if (targetScope === 'channel' && channelId) {
                    // Server has already pre-filtered by channel
                    // membership + channel_roles; trust that.
                    return true;
                }

                // System scope, or channel scope without channelId
                // context: fall back to client-side role-token check.
                return userMatchesTargetRole(u, targetRole, targetScope);
            });
            setResults(filtered);
            setLoading(false);
        }, 200);

        return () => {
            cancelled = true;
            window.clearTimeout(handle);
        };
    }, [term, dispatch, excludeIdsKey, targetRole, targetScope, teamId, channelId]);

    return (
        <div className='TestAccessRuleModal__addUsersWrap'>
            <button
                ref={refs.setReference}
                id='testAccessRuleAddUsers'
                type='button'
                aria-label={formatMessage({id: 'admin.access_control.test_access_rule.add_users', defaultMessage: 'Add users'})}
                className='btn btn-primary btn-sm TestAccessRuleModal__addUsers'
                {...getReferenceProps()}
            >
                <i className='icon icon-plus'/>
                <FormattedMessage
                    id='admin.access_control.test_access_rule.add_users'
                    defaultMessage='Add users'
                />
            </button>
            {open ? (
                <FloatingPortal>
                    {/* FloatingFocusManager owns focus while the popover is
                      * open: it moves focus to the search input on mount
                      * (initialFocus={0}) and restores it to the trigger
                      * button on close. modal=false lets the user click
                      * elsewhere on the page (e.g. another row) without
                      * being trapped inside the popover. */}
                    <FloatingFocusManager
                        context={context}
                        modal={false}
                        initialFocus={0}
                        returnFocus={true}
                    >
                        <div
                            ref={refs.setFloating}
                            className='TestAccessRuleModal__addUsersPanel'
                            data-testid='testAccessRuleAddUsersMenu'
                            aria-label={formatMessage({id: 'admin.access_control.test_access_rule.add_users_menu', defaultMessage: 'User search'})}
                            style={floatingStyles}
                            {...getFloatingProps()}
                        >
                            {/* Use the shared Input widget so the search
                              * field matches other admin-console outlined
                              * inputs (e.g. Search attributes…) — floating
                              * label, focus ring, etc. */}
                            <Input
                                type='text'
                                value={term}
                                placeholder={formatMessage({id: 'admin.access_control.test_access_rule.search_placeholder', defaultMessage: 'Search by name or email'})}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTerm(e.target.value)}
                            />
                            <div className='TestAccessRuleModal__addUsersResults'>
                                {loading ? (
                                    <div className='TestAccessRuleModal__addUsersHint'>
                                        <FormattedMessage
                                            id='admin.access_control.test_access_rule.searching'
                                            defaultMessage='Searching…'
                                        />
                                    </div>
                                ) : null}
                                {!loading && term && results.length === 0 ? (
                                    <div className='TestAccessRuleModal__addUsersHint'>
                                        <FormattedMessage
                                            id='admin.access_control.test_access_rule.no_results'
                                            defaultMessage='No matching users this rule could govern.'
                                        />
                                    </div>
                                ) : null}
                                {results.map((u) => (
                                    <button
                                        key={u.id}
                                        type='button'
                                        className='TestAccessRuleModal__addUsersResult'
                                        onClick={() => {
                                            onAdd(u);
                                            setTerm('');
                                            setResults([]);
                                            setOpen(false);
                                        }}
                                    >
                                        <img
                                            src={Client4.getProfilePictureUrl(u.id, u.last_picture_update)}
                                            alt=''
                                        />
                                        <span className='TestAccessRuleModal__addUsersResultMeta'>
                                            <span className='TestAccessRuleModal__addUsersResultName'>
                                                {displayUsername(u, 'full_name') || u.username}
                                            </span>
                                            <span className='TestAccessRuleModal__addUsersResultEmail'>
                                                {`@${u.username}`}{u.email ? ` · ${u.email}` : ''}
                                            </span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </FloatingFocusManager>
                </FloatingPortal>
            ) : null}
        </div>
    );
}

type PickerRowProps = {
    row: RowState;
    actions: string[];
    actionLabels?: Record<string, string>;
    pending: boolean;
    decisionsForUser?: Record<string, PolicySimulationActionDecision>;

    /** When false, the row hides the "Use active session" checkbox and the
     *  gear-icon configure panel — there are no session attributes
     *  configured in this deployment, so neither control would do
     *  anything meaningful. */
    sessionAttributesEnabled: boolean;
    onToggleActiveSession: (userId: string) => void;
    onRemove: (userId: string) => void;
};

function PickerRow({row, actions, actionLabels, pending, decisionsForUser, sessionAttributesEnabled, onToggleActiveSession, onRemove}: PickerRowProps): JSX.Element {
    const {formatMessage} = useIntl();
    const {user} = row;
    const [showBreakdown, setShowBreakdown] = useState(false);

    const aggregate = useMemo(
        () => aggregateDecisions(actions, decisionsForUser, pending),
        [actions, decisionsForUser, pending],
    );

    // Single-action rows render the regular DecisionChip directly so the
    // per-rule blame label stays visible without a click. Multi-action
    // rows collapse to a stacked Allowed/Mixed/Denied chip and reveal the
    // breakdown via PermissionBreakdownModal.
    const chipNode = useMemo(() => {
        if (actions.length <= 1) {
            const action = actions[0];
            return (
                <DecisionChip
                    decision={action ? decisionsForUser?.[action] : undefined}
                    pending={pending}
                />
            );
        }
        return (
            <StackedDecisionChip
                state={aggregate}
                count={actions.length}
                onClick={() => setShowBreakdown(true)}
            />
        );
    }, [actions, aggregate, decisionsForUser, pending]);

    return (
        <div className='TestAccessRuleModal__row'>
            {/* ProfilePicture with userId opens the standard profile popover
              * on click — same affordance the regular SearchableUserList
              * gives, so authors can quickly inspect attributes/roles for
              * a user that's behaving unexpectedly. */}
            <div className='TestAccessRuleModal__rowAvatar'>
                <ProfilePicture
                    src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                    userId={user.id}
                    username={user.username}
                    size='md'
                />
            </div>
            <div className='TestAccessRuleModal__rowName'>
                <span className='TestAccessRuleModal__rowDisplayName'>{displayUsername(user, 'full_name')}</span>
                <span className='TestAccessRuleModal__rowUsername'>{`@${user.username}`}</span>
            </div>
            <div className='TestAccessRuleModal__rowChips'>
                {chipNode}
            </div>
            {sessionAttributesEnabled ? (
                <>
                    <label className='TestAccessRuleModal__rowActiveSession'>
                        <input
                            type='checkbox'
                            data-testid='test-rule-row-use-active-session'
                            checked={row.useActiveSession}
                            onChange={() => onToggleActiveSession(user.id)}
                        />
                        <FormattedMessage
                            id='admin.access_control.test_access_rule.row.use_active_session'
                            defaultMessage='Use active session'
                        />
                    </label>
                    <Menu.Container
                        menuButton={{
                            id: `testRuleRowConfigure-${user.id}`,
                            'aria-label': formatMessage({id: 'admin.access_control.test_access_rule.row.configure', defaultMessage: 'Configure session attributes'}),
                            class: 'TestAccessRuleModal__rowConfigure',
                            children: <i className='icon icon-cog-outline'/>,
                        }}
                        menu={{
                            id: `testRuleRowConfigureMenu-${user.id}`,
                            'aria-label': formatMessage({id: 'admin.access_control.test_access_rule.row.configure', defaultMessage: 'Configure session attributes'}),
                        }}
                    >
                        <div
                            className='TestAccessRuleModal__configurePanel'
                            data-testid='test-rule-row-configure'
                        >
                            <span className='TestAccessRuleModal__configurePanelTitle'>
                                <FormattedMessage
                                    id='admin.access_control.test_access_rule.row.configure'
                                    defaultMessage='Configure session attributes'
                                />
                            </span>
                            <FormattedMessage
                                id='admin.access_control.test_access_rule.row.configure_coming_soon'
                                defaultMessage='Session attribute overrides are coming soon.'
                            />
                        </div>
                    </Menu.Container>
                </>
            ) : null}
            <button
                type='button'
                className='TestAccessRuleModal__rowRemove'
                aria-label={formatMessage({id: 'admin.access_control.test_access_rule.row.remove', defaultMessage: 'Remove user'})}
                onClick={() => onRemove(user.id)}
            >
                <i className='icon icon-close'/>
            </button>
            {showBreakdown ? (
                <PermissionBreakdownModal
                    onExited={() => setShowBreakdown(false)}
                    user={user}
                    actions={actions}
                    actionLabels={actionLabels}
                    decisions={decisionsForUser}
                    pending={pending}
                />
            ) : null}
        </div>
    );
}

type StackedDecisionChipProps = {
    state: AggregateDecisionState;
    count: number;
    onClick: () => void;
};

const stackedStateModifier: Record<AggregateDecisionState, string> = {
    pending: 'TestAccessRuleModal__rowChip--pending',
    'not-applicable': 'TestAccessRuleModal__rowChip--not-applicable',
    allowed: 'TestAccessRuleModal__rowChip--allow',
    denied: 'TestAccessRuleModal__rowChip--deny',
    mixed: 'TestAccessRuleModal__rowChip--mixed',
};

const stackedStateTestId: Record<AggregateDecisionState, string> = {
    pending: 'test-rule-row-chip-stacked-pending',
    'not-applicable': 'test-rule-row-chip-stacked-not-applicable',
    allowed: 'test-rule-row-chip-stacked-allow',
    denied: 'test-rule-row-chip-stacked-deny',
    mixed: 'test-rule-row-chip-stacked-mixed',
};

/**
 * Multi-action rollup chip. Clicking opens PermissionBreakdownModal so
 * the author can drill into per-permission decisions. The label is
 * intentionally compact ("Allowed", "Denied", "Mixed") because the
 * actual blame attribution lives in the breakdown modal — we don't want
 * to lose information, just defer it from the row scan.
 */
function StackedDecisionChip({state, count, onClick}: StackedDecisionChipProps): JSX.Element {
    const label = (() => {
        switch (state) {
        case 'pending':
            return (
                <FormattedMessage
                    id='admin.access_control.test_access_rule.chip.pending'
                    defaultMessage='Evaluating…'
                />
            );
        case 'not-applicable':
            return (
                <FormattedMessage
                    id='admin.access_control.test_access_rule.chip.stacked.not_applicable'
                    defaultMessage="Policy doesn't apply"
                />
            );
        case 'allowed':
            return (
                <FormattedMessage
                    id='admin.access_control.test_access_rule.chip.stacked.allowed'
                    defaultMessage='Allowed'
                />
            );
        case 'denied':
            return (
                <FormattedMessage
                    id='admin.access_control.test_access_rule.chip.stacked.denied'
                    defaultMessage='Denied'
                />
            );
        case 'mixed':
        default:
            return (
                <FormattedMessage
                    id='admin.access_control.test_access_rule.chip.stacked.mixed'
                    defaultMessage='Mixed'
                />
            );
        }
    })();

    return (
        <button
            type='button'
            className={`TestAccessRuleModal__rowChip TestAccessRuleModal__rowChip--stacked ${stackedStateModifier[state]}`}
            data-testid={stackedStateTestId[state]}
            onClick={onClick}
            disabled={state === 'pending'}
        >
            <span className='TestAccessRuleModal__rowChipLabel'>{label}</span>
            <span className='TestAccessRuleModal__rowChipCount'>{count}</span>
            <i className='icon icon-chevron-right TestAccessRuleModal__rowChipChevron'/>
        </button>
    );
}

export default TestAccessRuleModal;
