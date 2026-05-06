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
import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {
    AccessControlPolicy,
    PolicyEvaluationScope,
    PolicySimulationActionDecision,
    PolicySimulationByUsersParams,
    PolicySimulationResponse,
    PolicySimulationSession,
    PolicySimulationUserOverride,
} from '@mattermost/types/access_control';
import {POLICY_SIMULATION_BLAME_SOURCES} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties';
import {SESSION_ATTRIBUTES_GROUP_ID, supportsOptions} from '@mattermost/types/properties';
import type {UserProfile} from '@mattermost/types/users';

import {simulatePolicyForUsers} from 'mattermost-redux/actions/access_control';
import {getProfiles, getProfilesInChannel, searchProfiles} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import type {ActionResult} from 'mattermost-redux/types/actions';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import ProfilePicture from 'components/profile_picture';
import Input from 'components/widgets/inputs/input/input';

import {aggregateDecisions} from './decision_aggregate';
import type {AggregateDecisionState} from './decision_aggregate';
import DecisionChip from './decision_chip';
import DecisionDetailsModal from './decision_details_modal';
import {pickChannelRoleFromTokens, userIsSystemAdmin, userMatchesTargetRole} from './role_applicability';
import type {TargetScope} from './role_applicability';

import './simulate_access_modal.scss';

const USER_SEARCH_LIMIT = 20;
const USER_SEARCH_DEBOUNCE_MS = 200;

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
     *  rule are tagged source=this_rule. Also rendered in the modal
     *  subtitle ("Editing: <ruleName>"). */
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
     *  attribute group to drive the per-row session-attribute editor
     *  (pencil icon). When the group is empty/unset the pencil button
     *  is hidden — there are no overridable fields to surface. */
    accessControlFields?: UserPropertyField[];
};

type RowState = {
    user: UserProfile;
    sessionOverrides: Record<string, string>;
};

type UserDecisionsBundle = {
    decisions?: Record<string, PolicySimulationActionDecision>;
    sessions?: PolicySimulationSession[];

    /** User profile attribute snapshot returned by the simulator
     *  (department, region, etc.). Surfaced inside DecisionDetailsModal
     *  as part of the evaluation trace. */
    attributes?: Record<string, string>;
};

/**
 * Picker-driven "Simulate access" modal. The author hand-picks specific
 * users — pre-filtered by role applicability so an admin-targeted rule
 * can't be tested against regular members — and sees per-user, per-action
 * ALLOW/DENY chips with blame attribution coming back from
 * /access_control_policies/cel/simulate_users.
 *
 * Per-row controls:
 *  - Click row → expands the per-session breakdown when the response
 *    includes a sessions[] list. Falls back to a single synthetic
 *    "default session" entry when sessions are not returned (channel
 *    admin / no recent session).
 *  - Pencil icon opens an inline session-attribute editor whose fields
 *    are derived dynamically from accessControlFields filtered by
 *    SESSION_ATTRIBUTES_GROUP_ID. Apply marks the row dirty and the
 *    re-run button must be clicked to re-evaluate.
 *  - X removes the row.
 *
 * Re-evaluation is **manual only** via the Re-run button — there is no
 * auto-debounce. Authors stage all changes (add/remove users, toggle
 * scope, edit overrides) and re-run on demand.
 */
function SimulateAccessModal({
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
    const [results, setResults] = useState<Map<string, UserDecisionsBundle>>(() => new Map());
    const [pending, setPending] = useState<boolean>(false);
    const [scope, setScope] = useState<PolicyEvaluationScope>('all');
    const [showOnlyDenied, setShowOnlyDenied] = useState<boolean>(false);
    const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(() => new Set());

    // Session-attribute fields drive the per-row pencil panel. When the
    // deployment hasn't configured any session attributes yet, the editor
    // would be empty so we hide the pencil button entirely.
    const sessionAttributeFields = useMemo<UserPropertyField[]>(() => {
        if (!accessControlFields) {
            return [];
        }
        return accessControlFields.filter((f) => f.group_id === SESSION_ATTRIBUTES_GROUP_ID);
    }, [accessControlFields]);
    const sessionAttributesEnabled = sessionAttributeFields.length > 0;

    // Track the latest simulate request so out-of-order responses don't
    // overwrite the current view (e.g. a slow first simulate finishing
    // after a faster second one).
    const requestSeq = useRef(0);

    const runSimulate = useCallback(async (rowList?: RowState[], scopeOverride?: PolicyEvaluationScope) => {
        const list = rowList ?? Array.from(rows.values());
        const evaluationScope = scopeOverride ?? scope;
        if (list.length === 0 || actions.length === 0) {
            setResults(new Map());
            setPending(false);
            return;
        }

        setPending(true);
        const mySeq = ++requestSeq.current;

        const userOverrides: PolicySimulationUserOverride[] = list.map((r) => ({
            user_id: r.user.id,

            // The "use_active_session" affordance has been folded into the
            // per-row session editor: leaving the overrides empty means
            // "use the user's session as the server resolves it". When the
            // author has staged explicit overrides we pass them through
            // and the server merges them on top of the session snapshot.
            session_overrides: Object.keys(r.sessionOverrides).length > 0 ? r.sessionOverrides : undefined,
        }));

        const params: PolicySimulationByUsersParams = {
            policy,
            actions,
            rule_name: ruleName,
            channel_id: channelId,
            team_id: teamId,
            users: userOverrides,
            evaluation_scope: evaluationScope,
        };

        const result = await dispatch(simulatePolicyForUsers(params));
        if (mySeq !== requestSeq.current) {
            return;
        }

        const next = new Map<string, UserDecisionsBundle>();
        const data = (result as ActionResult<PolicySimulationResponse>).data;
        if (data) {
            for (const r of data.results) {
                if (r.user) {
                    next.set(r.user.id, {decisions: r.decisions, sessions: r.sessions, attributes: r.attributes});
                }
            }
        }
        setResults(next);
        setPending(false);
    }, [rows, actions, dispatch, policy, ruleName, channelId, teamId, scope]);

    // Add-user is the one trigger that auto-runs the simulator: picking
    // a user is the most common state change and the row would otherwise
    // sit there in pristine "no chip" state until the author manually
    // clicked Re-run. Other staged changes (scope toggle, session
    // overrides, denied filter, removing a row) still wait for an
    // explicit Re-run click. We schedule via setTimeout so the rows
    // setState commits before runSimulate reads it through its closure.
    // Add-user is the one trigger that auto-runs the simulator: picking
    // a user is the most common state change and the row would otherwise
    // sit there in pristine "no chip" state until the author manually
    // clicked Re-run. Other staged changes (scope toggle, session
    // overrides, denied filter, removing a row) still wait for an
    // explicit Re-run click. We pass the freshly-merged row list to
    // runSimulate directly so the dispatch sees the new user even before
    // React re-renders with the updated rows state.
    const handleAddUser = useCallback((user: UserProfile) => {
        setRows((prev) => {
            if (prev.has(user.id)) {
                return prev;
            }
            const next = new Map(prev);
            next.set(user.id, {
                user,
                sessionOverrides: {},
            });
            runSimulate(Array.from(next.values()));
            return next;
        });
    }, [runSimulate]);

    const handleRemoveUser = useCallback((userId: string) => {
        setRows((prev) => {
            if (!prev.has(userId)) {
                return prev;
            }
            const next = new Map(prev);
            next.delete(userId);
            return next;
        });
        setResults((prev) => {
            if (!prev.has(userId)) {
                return prev;
            }
            const next = new Map(prev);
            next.delete(userId);
            return next;
        });
        setExpandedUserIds((prev) => {
            if (!prev.has(userId)) {
                return prev;
            }
            const next = new Set(prev);
            next.delete(userId);
            return next;
        });
    }, []);

    const handleApplyOverrides = useCallback((userId: string, overrides: Record<string, string>) => {
        setRows((prev) => {
            const row = prev.get(userId);
            if (!row) {
                return prev;
            }
            const next = new Map(prev);
            next.set(userId, {...row, sessionOverrides: overrides});
            return next;
        });
    }, []);

    const handleToggleExpand = useCallback((userId: string) => {
        setExpandedUserIds((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) {
                next.delete(userId);
            } else {
                next.add(userId);
            }
            return next;
        });
    }, []);

    // Switching the "Evaluate against" scope has no visible effect
    // unless we re-dispatch — the existing decisions reflect the
    // previous scope. Auto-rerun on click so the toggle behaves the
    // way it reads (a single click, the table updates). We pass the
    // new scope through runSimulate explicitly because setScope is
    // batched and runSimulate's own closure would otherwise see the
    // previous value when invoked synchronously here.
    const handleScopeChange = useCallback((next: PolicyEvaluationScope) => {
        if (next === scope) {
            return;
        }
        setScope(next);
        if (rows.size > 0) {
            runSimulate(undefined, next);
        }
    }, [scope, rows, runSimulate]);

    // Filter rows for display based on the "Show only denied sessions"
    // checkbox. Filtering is purely a view concern — `rows` (the staged
    // selection) is unchanged so toggling the filter doesn't drop work.
    const visibleRows = useMemo(() => {
        const allRows = Array.from(rows.values());
        if (!showOnlyDenied) {
            return allRows;
        }
        return allRows.filter((row) => {
            const bundle = results.get(row.user.id);
            return rowHasDeny(actions, bundle);
        });
    }, [rows, results, actions, showOnlyDenied]);

    // Footer summary counts. Reflect the *evaluated* state of every staged
    // row, not the filtered view, so the totals don't seem to change just
    // because the author hid a denied row.
    const summary = useMemo(() => {
        let allowed = 0;
        let denied = 0;
        for (const row of rows.values()) {
            const bundle = results.get(row.user.id);
            if (!bundle?.decisions) {
                continue;
            }
            const state = aggregateDecisions(actions, bundle.decisions, false);
            if (state === 'allowed') {
                allowed++;
            } else if (state === 'denied' || state === 'mixed') {
                denied++;
            }
        }
        return {users: rows.size, allowed, denied};
    }, [rows, results, actions]);

    return (
        <GenericModal
            className='SimulateAccessModal a11y__modal'
            id='simulateAccessModal'
            show={true}
            onHide={onExited}
            onExited={onExited}
            modalHeaderText={
                <FormattedMessage
                    id='admin.access_control.simulate_access.title'
                    defaultMessage='Simulate access'
                />
            }
            showCloseButton={true}
            bodyPadding={false}
            compassDesign={true}
            ariaLabel={formatMessage({id: 'admin.access_control.simulate_access.title', defaultMessage: 'Simulate access'})}
            isStacked={isStacked}

            // We render our own footer so the row-count summary can sit
            // inline with the Close + Re-run buttons (left-aligned text +
            // right-aligned action group share the same row). The
            // GenericModal default footer only supports right-aligned
            // buttons, so opting into footerContent gives us full
            // control over the layout.
            footerContent={
                <div
                    className='SimulateAccessModal__footer'
                    data-testid='simulate-access-footer'
                >
                    <div
                        className='SimulateAccessModal__summary'
                        data-testid='simulate-access-summary'
                    >
                        <FormattedMessage
                            id='admin.access_control.simulate_access.summary'
                            defaultMessage='{users, plural, one {# user} other {# users}} · {allowed} allowed · {denied} denied'
                            values={{users: summary.users, allowed: summary.allowed, denied: summary.denied}}
                        />
                    </div>
                    <div className='SimulateAccessModal__footerActions'>
                        <button
                            type='button'
                            className='btn btn-tertiary'
                            onClick={onExited}
                        >
                            <FormattedMessage
                                id='admin.access_control.simulate_access.close'
                                defaultMessage='Close'
                            />
                        </button>
                        <button
                            type='button'
                            className='btn btn-primary'
                            data-testid='simulate-access-rerun'
                            disabled={rows.size === 0 || pending}
                            onClick={() => runSimulate()}
                        >
                            <FormattedMessage
                                id='admin.access_control.simulate_access.rerun'
                                defaultMessage='Re-run'
                            />
                        </button>
                    </div>
                </div>
            }

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
            <div className='SimulateAccessModal__subheader'>
                <p>
                    <FormattedMessage
                        id='admin.access_control.simulate_access.subtitle'
                        defaultMessage="Pick users to evaluate against the selected scope. Each row shows whether the action would be allowed for that user's most recent session."
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

            <div className='SimulateAccessModal__controls'>
                <div className='SimulateAccessModal__scopeToggle'>
                    <span className='SimulateAccessModal__scopeLabel'>
                        <FormattedMessage
                            id='admin.access_control.simulate_access.evaluate_against'
                            defaultMessage='Evaluate against'
                        />
                    </span>
                    <div
                        className='SimulateAccessModal__scopeSegments'
                        role='group'
                        aria-label={formatMessage({id: 'admin.access_control.simulate_access.evaluate_against', defaultMessage: 'Evaluate against'})}
                    >
                        <button
                            type='button'
                            className={classNames('SimulateAccessModal__scopeSegment', {
                                'SimulateAccessModal__scopeSegment--active': scope === 'all',
                            })}
                            aria-pressed={scope === 'all'}
                            data-testid='simulate-access-scope-all'
                            onClick={() => handleScopeChange('all')}
                        >
                            <FormattedMessage
                                id='admin.access_control.simulate_access.scope.all'
                                defaultMessage='All policies'
                            />
                        </button>
                        <button
                            type='button'
                            className={classNames('SimulateAccessModal__scopeSegment', {
                                'SimulateAccessModal__scopeSegment--active': scope === 'this_rule',
                            })}
                            aria-pressed={scope === 'this_rule'}
                            data-testid='simulate-access-scope-this-rule'
                            onClick={() => handleScopeChange('this_rule')}
                        >
                            <FormattedMessage
                                id='admin.access_control.simulate_access.scope.this_rule'
                                defaultMessage='This rule only'
                            />
                        </button>
                    </div>
                </div>
                <label className='SimulateAccessModal__deniedFilter'>
                    <input
                        type='checkbox'
                        checked={showOnlyDenied}
                        data-testid='simulate-access-show-only-denied'
                        onChange={() => setShowOnlyDenied((v) => !v)}
                    />
                    <FormattedMessage
                        id='admin.access_control.simulate_access.show_only_denied'
                        defaultMessage='Show only denied sessions'
                    />
                </label>
            </div>

            <div className='SimulateAccessModal__body'>
                {rows.size === 0 ? (
                    <div className='SimulateAccessModal__empty'>
                        <FormattedMessage
                            id='admin.access_control.simulate_access.empty_state'
                            defaultMessage='Pick users to dry-run the access expression as the policy decision point would at request time.'
                        />
                    </div>
                ) : (
                    <table
                        className={classNames('SimulateAccessModal__table', {
                            'SimulateAccessModal__table--noActivity': !sessionAttributesEnabled,
                        })}
                    >
                        <thead>
                            <tr>
                                <th>
                                    <FormattedMessage
                                        id='admin.access_control.simulate_access.col.user'
                                        defaultMessage='User'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='admin.access_control.simulate_access.col.result'
                                        defaultMessage='Result'
                                    />
                                </th>
                                {sessionAttributesEnabled ? (
                                    <th>
                                        <FormattedMessage
                                            id='admin.access_control.simulate_access.col.recent_activity'
                                            defaultMessage='Recent activity'
                                        />
                                    </th>
                                ) : null}
                                <th>
                                    <span className='sr-only'>
                                        <FormattedMessage
                                            id='admin.access_control.simulate_access.col.actions'
                                            defaultMessage='Actions'
                                        />
                                    </span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleRows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={sessionAttributesEnabled ? 4 : 3}
                                        className='SimulateAccessModal__empty'
                                    >
                                        <FormattedMessage
                                            id='admin.access_control.simulate_access.no_denied_results'
                                            defaultMessage='No denied results to show. Uncheck the filter to see all rows.'
                                        />
                                    </td>
                                </tr>
                            ) : visibleRows.map((row) => (
                                <PickerRow
                                    key={row.user.id}
                                    row={row}
                                    actions={actions}
                                    actionLabels={actionLabels}
                                    pending={pending}
                                    bundle={results.get(row.user.id)}
                                    policy={policy}
                                    sessionAttributeFields={sessionAttributeFields}
                                    sessionAttributesEnabled={sessionAttributesEnabled}
                                    expanded={expandedUserIds.has(row.user.id)}
                                    onToggleExpand={handleToggleExpand}
                                    onApplyOverrides={handleApplyOverrides}
                                    onRemove={handleRemoveUser}
                                />
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

        </GenericModal>
    );
}

/**
 * Returns true when a single-action chip should open
 * DecisionDetailsModal on click. We surface details for outcomes where
 * the modal has something useful to say:
 *   - Denies: rule + expression + attribute trace.
 *   - Allows whose only blame is `sibling_saved`: surfaces the rule
 *     that flipped a draft-side deny back to allow.
 *
 * Pending, plain-allow (no blame) and not-applicable chips stay
 * static — there's nothing the modal would show beyond the chip
 * itself.
 */
function shouldShowDecisionDetails(decision: PolicySimulationActionDecision | undefined): boolean {
    if (!decision) {
        return false;
    }
    if (!decision.decision) {
        return true;
    }
    if (!decision.blame) {
        return false;
    }
    return decision.blame.some((b) => b.source === POLICY_SIMULATION_BLAME_SOURCES.SIBLING_SAVED);
}

/**
 * Returns true when any per-action decision (top-level or inside any
 * session) is a deny. Used by the "Show only denied sessions" filter.
 * A row with no evaluation yet is treated as "not denied" so it doesn't
 * pop in/out as evaluations resolve.
 */
function rowHasDeny(actions: string[], bundle: UserDecisionsBundle | undefined): boolean {
    if (!bundle) {
        return false;
    }
    if (bundle.decisions) {
        for (const action of actions) {
            const dec = bundle.decisions[action];
            if (dec && !dec.decision) {
                return true;
            }
        }
    }
    if (bundle.sessions) {
        for (const session of bundle.sessions) {
            if (!session.decisions) {
                continue;
            }
            for (const action of actions) {
                const dec = session.decisions[action];
                if (dec && !dec.decision) {
                    return true;
                }
            }
        }
    }
    return false;
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
 * un-typeable.
 *
 * Channel-scope filtering applies the role-chain applicability check by
 * bulk-fetching the candidates' channel memberships
 * (Client4.getChannelMembersByIds) so members whose channel role doesn't
 * match the rule's targetRole are hidden from the picker. Sysadmins pass
 * through unconditionally — they act as effective channel admins on
 * every channel via the system_admin override and would otherwise be
 * silently dropped by the membership lookup (sysadmins are typically
 * not channel members).
 */
function AddUsersInline({onAdd, excludeIdsKey, excludeIds, targetRole, targetScope, teamId, channelId}: AddUsersInlineProps): JSX.Element {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const [term, setTerm] = useState('');
    const [results, setResults] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

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

    const excludeIdsRef = useRef(excludeIds);
    excludeIdsRef.current = excludeIds;

    useEffect(() => {
        if (!open) {
            // No-op while the popover is closed — avoids burning a
            // request on a hidden dropdown when the parent re-renders
            // (e.g. after a row is added).
            return undefined;
        }

        let cancelled = false;
        setLoading(true);
        // No debounce on the initial pre-populate fetch — the popover
        // just opened and we want results to appear immediately. The
        // typing-driven case still gets the standard debounce so we
        // don't fire a request per keystroke.
        const debounce = term ? USER_SEARCH_DEBOUNCE_MS : 0;
        const handle = window.setTimeout(async () => {
            const opts: Record<string, any> = {limit: USER_SEARCH_LIMIT};
            if (teamId) {
                opts.team_id = teamId;
            }

            if (targetScope === 'channel' && channelId) {
                // Scope to channel members only; do NOT pass
                // channel_roles. The server's channel_roles SQL
                // clause has an `AND Users.Roles NOT LIKE
                // %system_admin%` exclusion built into every branch
                // (admin / user / guest) so passing it would silently
                // drop sysadmins from the picker — even when a
                // sysadmin is a member of the channel they're
                // editing. Instead the picker filters channel-role
                // applicability client-side below, after a separate
                // bulk-fetch of the candidates' channel memberships,
                // and lets sysadmins through unconditionally (they
                // act as effective channel admins on every channel
                // via the system_admin override).
                opts.in_channel_id = channelId;
            }

            // Pre-populate with first-page profiles when the user
            // hasn't typed anything yet — saves them having to type to
            // see ANY result. Channel-scope drafts use the channel's
            // member list (already paginated, already cached); system-
            // scope falls back to the general profiles endpoint
            // optionally scoped to a team. The role-applicability
            // pipeline below applies uniformly to both branches, so a
            // bare "click + Add users" gives the same filtered view a
            // typed search would.
            let found: UserProfile[];
            if (term) {
                const action = await dispatch(searchProfiles(term, opts));
                if (cancelled) {
                    return;
                }
                found = (action as ActionResult<UserProfile[]>).data ?? [];
            } else if (targetScope === 'channel' && channelId) {
                const action = await dispatch(
                    getProfilesInChannel(channelId, 0, USER_SEARCH_LIMIT),
                );
                if (cancelled) {
                    return;
                }
                found = (action as ActionResult<UserProfile[]>).data ?? [];
            } else {
                const profileOpts: Record<string, any> = {};
                if (teamId) {
                    profileOpts.in_team = teamId;
                }
                const action = await dispatch(
                    getProfiles(0, USER_SEARCH_LIMIT, profileOpts),
                );
                if (cancelled) {
                    return;
                }
                found = (action as ActionResult<UserProfile[]>).data ?? [];
            }

            const candidates = found.filter((u) => !excludeIdsRef.current.has(u.id));
            if (candidates.length === 0) {
                setResults([]);
                setLoading(false);
                return;
            }

            // System scope: filter on the user's stored role tokens
            // alone — there's no channel-membership context to
            // reason about.
            if (targetScope !== 'channel' || !channelId) {
                const filtered = candidates.filter((u) =>
                    userMatchesTargetRole(u, targetRole, targetScope),
                );
                setResults(filtered);
                setLoading(false);
                return;
            }

            // Channel scope, no role constraint: keep all members.
            if (!targetRole) {
                setResults(candidates);
                setLoading(false);
                return;
            }

            // Channel scope with a role constraint: bulk-fetch the
            // candidates' channel memberships in a single
            // round-trip, then apply role-chain applicability on the
            // client. Sysadmins pass through unconditionally —
            // they're effective admins regardless of channel
            // membership.
            const sysadmins = candidates.filter(userIsSystemAdmin);
            const nonSysadmins = candidates.filter((u) => !userIsSystemAdmin(u));

            let memberRoleByUserId = new Map<string, string>();
            if (nonSysadmins.length > 0) {
                try {
                    const members = await Client4.getChannelMembersByIds(
                        channelId,
                        nonSysadmins.map((u) => u.id),
                    );
                    if (cancelled) {
                        return;
                    }
                    memberRoleByUserId = new Map(
                        members.map((m) => [m.user_id, m.roles ?? '']),
                    );
                } catch {
                    // Best-effort: if the membership lookup fails we
                    // fall back to "no channel role" for everyone,
                    // which excludes regular members per
                    // userMatchesTargetRole semantics. That's the
                    // conservative outcome when authoring a
                    // role-targeted rule.
                }
            }

            const filteredNonSysadmins = nonSysadmins.filter((u) => {
                const channelMemberRole = pickChannelRoleFromTokens(
                    memberRoleByUserId.get(u.id) ?? '',
                );
                return userMatchesTargetRole(u, targetRole, 'channel', channelMemberRole);
            });

            // Preserve the search ordering by walking `candidates`
            // and including each user when it's in the kept set.
            const keep = new Set([
                ...sysadmins.map((u) => u.id),
                ...filteredNonSysadmins.map((u) => u.id),
            ]);
            setResults(candidates.filter((u) => keep.has(u.id)));
            setLoading(false);
        }, debounce);

        return () => {
            cancelled = true;
            window.clearTimeout(handle);
        };
    }, [open, term, dispatch, excludeIdsKey, targetRole, targetScope, teamId, channelId]);

    // Reset cached results whenever the popover closes so reopening
    // shows a fresh fetch (and a brief loading state) instead of stale
    // data from the previous session.
    useEffect(() => {
        if (!open) {
            setResults([]);
            setTerm('');
        }
    }, [open]);

    return (
        <div className='SimulateAccessModal__addUsersWrap'>
            <button
                ref={refs.setReference}
                id='simulateAccessAddUsers'
                type='button'
                aria-label={formatMessage({id: 'admin.access_control.simulate_access.add_users', defaultMessage: 'Add users'})}
                className='btn btn-primary btn-sm SimulateAccessModal__addUsers'
                {...getReferenceProps()}
            >
                <i className='icon icon-plus'/>
                <FormattedMessage
                    id='admin.access_control.simulate_access.add_users'
                    defaultMessage='Add users'
                />
            </button>
            {open ? (
                <FloatingPortal>
                    <FloatingFocusManager
                        context={context}
                        modal={false}
                        initialFocus={0}
                        returnFocus={true}
                    >
                        <div
                            ref={refs.setFloating}
                            className='SimulateAccessModal__addUsersPanel'
                            data-testid='simulateAccessAddUsersMenu'
                            aria-label={formatMessage({id: 'admin.access_control.simulate_access.add_users_menu', defaultMessage: 'User search'})}
                            style={floatingStyles}
                            {...getFloatingProps()}
                        >
                            <Input
                                type='text'
                                value={term}
                                placeholder={formatMessage({id: 'admin.access_control.simulate_access.search_placeholder', defaultMessage: 'Search by name or email'})}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTerm(e.target.value)}
                            />
                            <div className='SimulateAccessModal__addUsersResults'>
                                {loading ? (
                                    <div className='SimulateAccessModal__addUsersHint'>
                                        <FormattedMessage
                                            id='admin.access_control.simulate_access.searching'
                                            defaultMessage='Searching…'
                                        />
                                    </div>
                                ) : null}
                                {!loading && term && results.length === 0 ? (
                                    <div className='SimulateAccessModal__addUsersHint'>
                                        <FormattedMessage
                                            id='admin.access_control.simulate_access.no_results'
                                            defaultMessage='No matching users this rule could govern.'
                                        />
                                    </div>
                                ) : null}
                                {results.map((u) => (
                                    <button
                                        key={u.id}
                                        type='button'
                                        className='SimulateAccessModal__addUsersResult'
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
                                        <span className='SimulateAccessModal__addUsersResultMeta'>
                                            <span className='SimulateAccessModal__addUsersResultName'>
                                                {displayUsername(u, 'full_name') || u.username}
                                            </span>
                                            <span className='SimulateAccessModal__addUsersResultEmail'>
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
    bundle?: UserDecisionsBundle;

    /** Draft policy currently being edited. Forwarded to
     *  DecisionDetailsModal so it can fall back to a client-side
     *  expression lookup for draft-side blame entries when the
     *  simulator didn't pre-populate `blame.expression`. */
    policy: AccessControlPolicy;

    /** Session-attribute property fields used to render the pencil-icon
     *  override editor. Empty array → pencil button is hidden. */
    sessionAttributeFields: UserPropertyField[];
    sessionAttributesEnabled: boolean;
    expanded: boolean;
    onToggleExpand: (userId: string) => void;
    onApplyOverrides: (userId: string, overrides: Record<string, string>) => void;
    onRemove: (userId: string) => void;
};

function PickerRow({
    row,
    actions,
    actionLabels,
    pending,
    bundle,
    policy,
    sessionAttributeFields,
    sessionAttributesEnabled,
    expanded,
    onToggleExpand,
    onApplyOverrides,
    onRemove,
}: PickerRowProps): JSX.Element {
    const {formatMessage} = useIntl();
    const {user} = row;
    const [showDetails, setShowDetails] = useState(false);

    // Single-action rows render the regular DecisionChip directly so the
    // per-rule blame label stays visible without a click. Multi-action
    // rows collapse to a stacked Allowed/Mixed/Denied chip and reveal
    // the per-action breakdown via DecisionDetailsModal.
    const aggregate = useMemo(
        () => aggregateDecisions(actions, bundle?.decisions, pending),
        [actions, bundle, pending],
    );

    // For single-action rows the chip is the only deny affordance, so
    // wrap it in a button when there's something to drill into. We open
    // the same DecisionDetailsModal the multi-action stacked chip uses,
    // just with one action in the body — that's the canonical "Why
    // denied?" surface across the picker.
    const chipNode = useMemo(() => {
        if (actions.length <= 1) {
            const action = actions[0];
            const decision = action ? bundle?.decisions?.[action] : undefined;
            const chip = (
                <DecisionChip
                    decision={decision}
                    pending={pending}
                />
            );
            const drillable = !pending && shouldShowDecisionDetails(decision);
            if (!drillable) {
                return chip;
            }
            return (
                <button
                    type='button'
                    className='SimulateAccessModal__rowChipButton'
                    data-testid='simulate-access-row-chip-button'
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowDetails(true);
                    }}
                >
                    {chip}
                </button>
            );
        }
        return (
            <StackedDecisionChip
                state={aggregate}
                count={actions.length}
                onClick={() => setShowDetails(true)}
            />
        );
    }, [actions, aggregate, bundle, pending]);

    const sessionsCount = bundle?.sessions?.length ?? 0;
    const deniedSessionsCount = useMemo(() => {
        if (!bundle?.sessions) {
            return 0;
        }
        let count = 0;
        for (const s of bundle.sessions) {
            const state = aggregateDecisions(actions, s.decisions, false);
            if (state === 'denied' || state === 'mixed') {
                count++;
            }
        }
        return count;
    }, [bundle, actions]);

    // The recent-activity column reads "X sessions" when every session
    // resolves the same way, or "Y of X sessions" when some sessions
    // denied (so the author can spot mixed-result users at a glance).
    const recentActivityLabel = useMemo(() => {
        if (sessionsCount === 0) {
            return null;
        }
        if (deniedSessionsCount > 0 && deniedSessionsCount < sessionsCount) {
            return (
                <FormattedMessage
                    id='admin.access_control.simulate_access.activity.partial'
                    defaultMessage='{denied} of {total, plural, one {# session} other {# sessions}}'
                    values={{denied: deniedSessionsCount, total: sessionsCount}}
                />
            );
        }
        return (
            <FormattedMessage
                id='admin.access_control.simulate_access.activity.total'
                defaultMessage='{total, plural, one {# session} other {# sessions}}'
                values={{total: sessionsCount}}
            />
        );
    }, [sessionsCount, deniedSessionsCount]);

    // Per-session expand only makes sense when the deployment has
    // configured session-attribute fields — otherwise the unfold UI
    // would misalign with the parent table (RECENT ACTIVITY column is
    // hidden) and there's nothing meaningful for the author to inspect.
    const expandable = sessionAttributesEnabled && sessionsCount > 0;

    const handleRowKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
        if (!expandable) {
            return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand(user.id);
        }
    };

    return (
        <>
            <tr
                className={classNames('SimulateAccessModal__row', {
                    'SimulateAccessModal__row--expandable': expandable,
                    'SimulateAccessModal__row--expanded': expanded,
                })}
                role={expandable ? 'button' : undefined}
                tabIndex={expandable ? 0 : undefined}
                aria-expanded={expandable ? expanded : undefined}
                onClick={expandable ? () => onToggleExpand(user.id) : undefined}
                onKeyDown={handleRowKeyDown}
            >
                <td className='SimulateAccessModal__rowUser'>
                    <div className='SimulateAccessModal__rowAvatar'>
                        <ProfilePicture
                            src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                            userId={user.id}
                            username={user.username}
                            size='md'
                        />
                    </div>
                    <div className='SimulateAccessModal__rowName'>
                        <span className='SimulateAccessModal__rowDisplayName'>{displayUsername(user, 'full_name')}</span>
                        <span className='SimulateAccessModal__rowUsername'>{`@${user.username}`}</span>
                    </div>
                </td>
                <td className='SimulateAccessModal__rowResult'>
                    {chipNode}
                </td>
                {sessionAttributesEnabled ? (
                    <td className='SimulateAccessModal__rowActivity'>
                        {recentActivityLabel ? (
                            <span className='SimulateAccessModal__rowActivityLabel'>
                                {recentActivityLabel}
                                <i
                                    className={classNames('icon', {
                                        'icon-chevron-up': expanded,
                                        'icon-chevron-down': !expanded,
                                    })}
                                    aria-hidden='true'
                                />
                            </span>
                        ) : (
                            <span className='SimulateAccessModal__rowActivityEmpty'>{'—'}</span>
                        )}
                    </td>
                ) : null}
                <td
                    className='SimulateAccessModal__rowActions'

                    // Stop row-click propagation so clicking the pencil
                    // or remove button doesn't also expand/collapse.
                    onClick={(e) => e.stopPropagation()}
                >
                    {sessionAttributesEnabled ? (
                        <SessionAttributeEditorButton
                            userId={user.id}
                            displayName={displayUsername(user, 'full_name') || user.username}
                            fields={sessionAttributeFields}
                            currentOverrides={row.sessionOverrides}
                            onApply={onApplyOverrides}
                        />
                    ) : null}
                    <button
                        type='button'
                        className='SimulateAccessModal__rowRemove'
                        aria-label={formatMessage({id: 'admin.access_control.simulate_access.row.remove', defaultMessage: 'Remove user'})}
                        onClick={() => onRemove(user.id)}
                    >
                        <i className='icon icon-close'/>
                    </button>
                </td>
            </tr>
            {expanded && bundle?.sessions ? (
                bundle.sessions.map((session, idx) => (
                    <SessionRow
                        key={session.id || `${user.id}-session-${idx}`}
                        session={session}
                        actions={actions}
                    />
                ))
            ) : null}
            {showDetails ? (
                <DecisionDetailsModal
                    onExited={() => setShowDetails(false)}
                    user={user}
                    actions={actions}
                    actionLabels={actionLabels}
                    decisions={bundle?.decisions}
                    pending={pending}
                    policy={policy}
                    userAttributes={bundle?.attributes}
                />
            ) : null}
        </>
    );
}

type SessionRowProps = {
    session: PolicySimulationSession;
    actions: string[];
};

function SessionRow({session, actions}: SessionRowProps): JSX.Element {
    const aggregate = useMemo(
        () => aggregateDecisions(actions, session.decisions, false),
        [actions, session.decisions],
    );

    const meta: string[] = [];
    if (session.device) {
        meta.push(session.device);
    }
    if (session.network) {
        meta.push(session.network);
    }

    return (
        <tr
            className='SimulateAccessModal__sessionRow'
            data-testid='simulate-access-session-row'
        >
            <td colSpan={2}>
                <div className='SimulateAccessModal__sessionMeta'>
                    <span
                        className='SimulateAccessModal__sessionDot'
                        aria-hidden='true'
                    >{'—'}</span>
                    <div>
                        <div className='SimulateAccessModal__sessionDevice'>{meta.join(' · ') || '—'}</div>
                        {typeof session.last_active_at === 'number' ? (
                            <div className='SimulateAccessModal__sessionLastActive'>
                                <FormattedMessage
                                    id='admin.access_control.simulate_access.session.last_active'
                                    defaultMessage='Last active {ts}'
                                    values={{ts: relativeTime(session.last_active_at)}}
                                />
                            </div>
                        ) : null}
                    </div>
                </div>
            </td>
            <td colSpan={2}>
                <SessionStateChip state={aggregate}/>
            </td>
        </tr>
    );
}

/**
 * Best-effort client-side relative-time formatter for the per-session
 * "Last active" caption. Avoids a full `Intl.RelativeTimeFormat` dance
 * because the captions are intentionally compact ("32 sec ago",
 * "4 min ago", "2 hr ago"); we lose nothing by approximating.
 */
function relativeTime(ts: number): string {
    const deltaMs = Date.now() - ts;
    if (deltaMs < 0 || !Number.isFinite(deltaMs)) {
        return '—';
    }
    const sec = Math.round(deltaMs / 1000);
    if (sec < 60) {
        return `${sec} sec ago`;
    }
    const min = Math.round(sec / 60);
    if (min < 60) {
        return `${min} min ago`;
    }
    const hr = Math.round(min / 60);
    if (hr < 24) {
        return `${hr} hr ago`;
    }
    const day = Math.round(hr / 24);
    return `${day} day ago`;
}

type SessionStateChipProps = {
    state: AggregateDecisionState;
};

const sessionStateClass: Record<AggregateDecisionState, string> = {
    pending: 'SimulateAccessModal__rowChip--pending',
    'not-applicable': 'SimulateAccessModal__rowChip--not-applicable',
    allowed: 'SimulateAccessModal__rowChip--allow',
    denied: 'SimulateAccessModal__rowChip--deny',
    mixed: 'SimulateAccessModal__rowChip--mixed',
};

/**
 * Static (non-clickable) chip used inside the per-session unfold rows.
 * Sessions intentionally render a single aggregate verdict — we don't
 * stack permission counts here; multi-permission rollups live on the
 * parent row's StackedDecisionChip and the breakdown modal.
 */
function SessionStateChip({state}: SessionStateChipProps): JSX.Element {
    const label = sessionStateLabel(state);
    return (
        <span
            className={`SimulateAccessModal__rowChip ${sessionStateClass[state]}`}
            data-testid={`simulate-access-session-chip-${state}`}
        >
            {label}
        </span>
    );
}

function sessionStateLabel(state: AggregateDecisionState): JSX.Element {
    switch (state) {
    case 'pending':
        return (
            <FormattedMessage
                id='admin.access_control.simulate_access.chip.pending'
                defaultMessage='Evaluating…'
            />
        );
    case 'not-applicable':
        return (
            <FormattedMessage
                id='admin.access_control.simulate_access.chip.stacked.not_applicable'
                defaultMessage="Policy doesn't apply"
            />
        );
    case 'allowed':
        return (
            <FormattedMessage
                id='admin.access_control.simulate_access.chip.stacked.allowed'
                defaultMessage='Allowed'
            />
        );
    case 'denied':
        return (
            <FormattedMessage
                id='admin.access_control.simulate_access.chip.stacked.denied'
                defaultMessage='Denied'
            />
        );
    case 'mixed':
    default:
        return (
            <FormattedMessage
                id='admin.access_control.simulate_access.chip.stacked.mixed'
                defaultMessage='Mixed'
            />
        );
    }
}

type SessionAttributeEditorButtonProps = {
    userId: string;
    displayName: string;
    fields: UserPropertyField[];
    currentOverrides: Record<string, string>;
    onApply: (userId: string, overrides: Record<string, string>) => void;
};

/**
 * Pencil-icon button that opens the per-row session-attribute editor
 * popover. The form is rendered dynamically from the session-attribute
 * property group: select-typed fields with options become dropdowns,
 * everything else becomes a text input. Applying writes back into the
 * row's session_overrides map and the next Re-run picks them up.
 *
 * The form is intentionally flat (no internal validation or async
 * submission): overrides are best-effort hints to the simulator. The
 * server validates expressions against the actual values at evaluation
 * time, so an invalid override surfaces as a deny rather than a form
 * error.
 */
function SessionAttributeEditorButton({userId, displayName, fields, currentOverrides, onApply}: SessionAttributeEditorButtonProps): JSX.Element {
    const {formatMessage} = useIntl();
    const [open, setOpen] = useState(false);

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
        useDismiss(context, {outsidePress: true, escapeKey: true}),
        useRole(context, {role: 'dialog'}),
    ]);

    return (
        <>
            <button
                ref={refs.setReference}
                type='button'
                className='SimulateAccessModal__rowConfigure'
                data-testid={`simulate-access-row-edit-${userId}`}
                aria-label={formatMessage({id: 'admin.access_control.simulate_access.row.edit', defaultMessage: 'Edit session attribute values'})}
                {...getReferenceProps()}
            >
                <i className='icon icon-pencil-outline'/>
            </button>
            {open ? (
                <FloatingPortal>
                    <FloatingFocusManager
                        context={context}
                        modal={false}
                        initialFocus={0}
                        returnFocus={true}
                    >
                        <div
                            ref={refs.setFloating}
                            className='SimulateAccessModal__editorPanel'
                            data-testid='simulate-access-row-editor'
                            aria-label={formatMessage({id: 'admin.access_control.simulate_access.row.edit', defaultMessage: 'Edit session attribute values'})}
                            style={floatingStyles}
                            {...getFloatingProps()}
                        >
                            <SessionAttributeEditorForm
                                displayName={displayName}
                                fields={fields}
                                initialOverrides={currentOverrides}
                                onCancel={() => setOpen(false)}
                                onApply={(overrides) => {
                                    onApply(userId, overrides);
                                    setOpen(false);
                                }}
                            />
                        </div>
                    </FloatingFocusManager>
                </FloatingPortal>
            ) : null}
        </>
    );
}

type SessionAttributeEditorFormProps = {
    displayName: string;
    fields: UserPropertyField[];
    initialOverrides: Record<string, string>;
    onCancel: () => void;
    onApply: (overrides: Record<string, string>) => void;
};

function SessionAttributeEditorForm({displayName, fields, initialOverrides, onCancel, onApply}: SessionAttributeEditorFormProps): JSX.Element {
    const {formatMessage} = useIntl();
    const [values, setValues] = useState<Record<string, string>>(initialOverrides);

    const handleSet = (name: string, value: string) => {
        setValues((prev) => {
            const next = {...prev};
            if (value === '') {
                delete next[name];
            } else {
                next[name] = value;
            }
            return next;
        });
    };

    return (
        <form
            className='SimulateAccessModal__editorForm'
            onSubmit={(e) => {
                e.preventDefault();
                onApply(values);
            }}
        >
            <div className='SimulateAccessModal__editorTitle'>
                <FormattedMessage
                    id='admin.access_control.simulate_access.editor.title'
                    defaultMessage='Edit session attribute values for {displayName}'
                    values={{displayName}}
                />
            </div>
            <div className='SimulateAccessModal__editorDescription'>
                <FormattedMessage
                    id='admin.access_control.simulate_access.editor.description'
                    defaultMessage='Override the values used in this simulation. The change applies only to this run.'
                />
            </div>
            {fields.length === 0 ? (
                <div className='SimulateAccessModal__editorEmpty'>
                    <FormattedMessage
                        id='admin.access_control.simulate_access.editor.empty'
                        defaultMessage='No session attributes are configured yet.'
                    />
                </div>
            ) : (
                <div className='SimulateAccessModal__editorGrid'>
                    {fields.map((field) => (
                        <SessionAttributeFieldControl
                            key={field.id}
                            field={field}
                            value={values[field.name] ?? ''}
                            onChange={(v) => handleSet(field.name, v)}
                        />
                    ))}
                </div>
            )}
            <div className='SimulateAccessModal__editorActions'>
                <button
                    type='button'
                    className='btn btn-tertiary'
                    onClick={onCancel}
                >
                    <FormattedMessage
                        id='admin.access_control.simulate_access.editor.cancel'
                        defaultMessage='Cancel'
                    />
                </button>
                <button
                    type='submit'
                    className='btn btn-primary'
                    aria-label={formatMessage({id: 'admin.access_control.simulate_access.editor.apply', defaultMessage: 'Apply'})}
                >
                    <FormattedMessage
                        id='admin.access_control.simulate_access.editor.apply'
                        defaultMessage='Apply'
                    />
                </button>
            </div>
        </form>
    );
}

type SessionAttributeFieldControlProps = {
    field: UserPropertyField;
    value: string;
    onChange: (value: string) => void;
};

function SessionAttributeFieldControl({field, value, onChange}: SessionAttributeFieldControlProps): JSX.Element {
    const options = field.attrs?.options ?? [];

    if (supportsOptions(field) && options.length > 0) {
        return (
            <label className='SimulateAccessModal__editorField'>
                <span className='SimulateAccessModal__editorFieldLabel'>{field.name}</span>
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className='SimulateAccessModal__editorFieldSelect'
                >
                    <option value=''>{'—'}</option>
                    {options.map((opt) => (
                        <option
                            key={opt.id}
                            value={opt.name}
                        >
                            {opt.name}
                        </option>
                    ))}
                </select>
            </label>
        );
    }

    return (
        <label className='SimulateAccessModal__editorField'>
            <span className='SimulateAccessModal__editorFieldLabel'>{field.name}</span>
            <input
                type='text'
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className='SimulateAccessModal__editorFieldInput'
            />
        </label>
    );
}

type StackedDecisionChipProps = {
    state: AggregateDecisionState;
    count: number;
    onClick: () => void;
};

const stackedStateModifier: Record<AggregateDecisionState, string> = {
    pending: 'SimulateAccessModal__rowChip--pending',
    'not-applicable': 'SimulateAccessModal__rowChip--not-applicable',
    allowed: 'SimulateAccessModal__rowChip--allow',
    denied: 'SimulateAccessModal__rowChip--deny',
    mixed: 'SimulateAccessModal__rowChip--mixed',
};

const stackedStateTestId: Record<AggregateDecisionState, string> = {
    pending: 'simulate-access-row-chip-stacked-pending',
    'not-applicable': 'simulate-access-row-chip-stacked-not-applicable',
    allowed: 'simulate-access-row-chip-stacked-allow',
    denied: 'simulate-access-row-chip-stacked-deny',
    mixed: 'simulate-access-row-chip-stacked-mixed',
};

/**
 * Multi-action rollup chip on the parent row. Clicking opens
 * DecisionDetailsModal so the author can drill into per-permission
 * decisions, the failing rule, and the attribute snapshot. The label
 * is intentionally compact ("Allowed", "Denied", "Mixed") because the
 * actual blame attribution lives in the details modal — we don't want
 * to lose information, just defer it from the row scan.
 */
function StackedDecisionChip({state, count, onClick}: StackedDecisionChipProps): JSX.Element {
    const label = sessionStateLabel(state);
    return (
        <button
            type='button'
            className={`SimulateAccessModal__rowChip SimulateAccessModal__rowChip--stacked ${stackedStateModifier[state]}`}
            data-testid={stackedStateTestId[state]}
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            disabled={state === 'pending'}
        >
            <span className='SimulateAccessModal__rowChipLabel'>{label}</span>
            <span className='SimulateAccessModal__rowChipCount'>{count}</span>
            <i className='icon icon-chevron-right SimulateAccessModal__rowChipChevron'/>
        </button>
    );
}

export default SimulateAccessModal;
