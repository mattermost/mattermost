// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {CheckIcon, ChevronDownIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';
import {Button} from '@mattermost/shared/components/button';
import type {
    AccessControlPolicy,
    PolicyEvaluationScope,
    PolicySimulationByUsersParams,
    PolicySimulationResponse,
    PolicySimulationUserOverride,
} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties';
import {SESSION_ATTRIBUTES_GROUP_ID} from '@mattermost/types/properties';
import type {UserProfile} from '@mattermost/types/users';

import {simulatePolicyForUsers} from 'mattermost-redux/actions/access_control';
import type {ActionResult} from 'mattermost-redux/types/actions';

import * as Menu from 'components/menu';

import AddUsersInline from './add_users_inline';
import {aggregateDecisions} from './decision_aggregate';
import PickerRow from './picker_row';
import type {TargetScope} from './role_applicability';
import type {RowState, UserDecisionsBundle} from './types';

import './simulate_access_modal.scss';

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

    // Permission filter: empty string means "All permissions". When the
    // author picks a specific action, every per-row chip / summary /
    // detail collapses to just that action — useful for quickly
    // checking a single permission when a rule grants several.
    const [selectedAction, setSelectedAction] = useState<string>('');
    const effectiveActions = useMemo(
        () => (selectedAction && actions.includes(selectedAction) ? [selectedAction] : actions),
        [selectedAction, actions],
    );

    // If `actions` changes (parent re-renders with a different set) and
    // the previously-selected action is no longer in scope, fall back
    // to "All permissions" so the filter doesn't silently target a
    // stale value.
    useEffect(() => {
        if (selectedAction && !actions.includes(selectedAction)) {
            setSelectedAction('');
        }
    }, [actions, selectedAction]);
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

    // The picker no longer hides rows — the permission filter narrows
    // the chip/summary scope per row instead. Keeping `visibleRows` as
    // a thin alias of `rows.values()` preserves the surrounding code
    // shape (single point to extend later if a new filter is added).
    const visibleRows = useMemo(() => Array.from(rows.values()), [rows]);

    // Footer summary counts. Aggregates over `effectiveActions` so the
    // tallies match what the row chips show — picking a single
    // permission filters the summary to that permission's verdicts.
    const summary = useMemo(() => {
        let allowed = 0;
        let denied = 0;
        for (const row of rows.values()) {
            const bundle = results.get(row.user.id);
            if (!bundle?.decisions) {
                continue;
            }
            const state = aggregateDecisions(effectiveActions, bundle.decisions, false);
            if (state === 'allowed') {
                allowed++;
            } else if (state === 'denied' || state === 'mixed') {
                denied++;
            }
        }
        return {users: rows.size, allowed, denied};
    }, [rows, results, effectiveActions]);

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
                        <Button
                            emphasis='tertiary'
                            onClick={onExited}
                        >
                            <FormattedMessage
                                id='admin.access_control.simulate_access.close'
                                defaultMessage='Close'
                            />
                        </Button>
                        <Button
                            data-testid='simulate-access-rerun'
                            disabled={rows.size === 0 || pending}
                            onClick={() => runSimulate()}
                        >
                            <FormattedMessage
                                id='admin.access_control.simulate_access.rerun'
                                defaultMessage='Re-run'
                            />
                        </Button>
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
                {/* Permission filter — defaults to "All permissions".
                  * For multi-action rules, picking a specific permission
                  * collapses every per-row chip and the footer summary
                  * down to that one action's verdicts. Hidden when the
                  * rule has only one action (nothing to filter).
                  * Mattermost-styled dropdown using Menu.Container so
                  * the look matches the rest of the access-control
                  * editors. */}
                {actions.length > 1 ? (
                    <Menu.Container
                        menuButton={{
                            id: 'simulate-access-permission-filter-button',
                            class: 'btn btn-transparent SimulateAccessModal__filterButton',
                            children: (
                                <>
                                    <span className='SimulateAccessModal__filterButtonLabel'>
                                        {selectedAction ?
                                            (actionLabels?.[selectedAction] ?? selectedAction) :
                                            formatMessage({
                                                id: 'admin.access_control.simulate_access.permission_filter.all',
                                                defaultMessage: 'All permissions',
                                            })
                                        }
                                    </span>
                                    <ChevronDownIcon
                                        size={16}
                                        color='rgba(var(--center-channel-color-rgb), 0.64)'
                                    />
                                </>
                            ),
                            dataTestId: 'simulate-access-permission-filter',
                            'aria-label': formatMessage({
                                id: 'admin.access_control.simulate_access.permission_filter.label',
                                defaultMessage: 'Permission',
                            }),
                        }}
                        menu={{
                            id: 'simulate-access-permission-filter-menu',
                            'aria-label': formatMessage({
                                id: 'admin.access_control.simulate_access.permission_filter.label',
                                defaultMessage: 'Permission',
                            }),
                        }}
                    >
                        <Menu.Item
                            id='simulate-access-permission-filter-all'
                            role='menuitemradio'
                            forceCloseOnSelect={true}
                            aria-checked={selectedAction === ''}
                            onClick={() => setSelectedAction('')}
                            labels={
                                <FormattedMessage
                                    id='admin.access_control.simulate_access.permission_filter.all'
                                    defaultMessage='All permissions'
                                />
                            }
                            trailingElements={selectedAction === '' && <CheckIcon size={16}/>}
                        />
                        {actions.map((action) => (
                            <Menu.Item
                                key={action}
                                id={`simulate-access-permission-filter-${action}`}
                                role='menuitemradio'
                                forceCloseOnSelect={true}
                                aria-checked={selectedAction === action}
                                onClick={() => setSelectedAction(action)}
                                labels={<span>{actionLabels?.[action] ?? action}</span>}
                                trailingElements={selectedAction === action && <CheckIcon size={16}/>}
                            />
                        ))}
                    </Menu.Container>
                ) : <span/>}
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
                            {visibleRows.map((row) => (
                                <PickerRow
                                    key={row.user.id}
                                    row={row}
                                    actions={effectiveActions}
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

export default SimulateAccessModal;
