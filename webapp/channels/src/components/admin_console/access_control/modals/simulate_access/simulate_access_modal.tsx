// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

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
import {getProfiles, getProfilesInChannel, searchProfiles} from 'mattermost-redux/actions/users';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import type {ActionResult} from 'mattermost-redux/types/actions';

import * as Menu from 'components/menu';

import PickerRow from './picker_row';
import {userIsSystemAdmin} from './role_applicability';
import type {TargetScope} from './role_applicability';
import type {RowState, UserDecisionsBundle} from './types';

import './simulate_access_modal.scss';

// Initial page size kept tight (10) so the modal opens fast even on
// large rosters and the simulator only fans out to 10 users per
// dispatch. Pagination handles the long tail; typed search bypasses
// pagination and falls back to the searchProfiles top-N response.
const USER_PAGE_SIZE = 10;
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
    const currentUser = useSelector(getCurrentUser);
    const {formatMessage} = useIntl();

    const [users, setUsers] = useState<UserProfile[]>([]);
    const [page, setPage] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [hasNextPage, setHasNextPage] = useState(false);
    const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
    const [usersError, setUsersError] = useState<string>('');

    // Per-user session-attribute overrides survive search/pagination
    // so editing user A's overrides on page 1, navigating to page 2,
    // and coming back keeps the edits in place. Keyed on user.id; the
    // RowState views below derive overrides from this map at render time.
    const [sessionOverridesById, setSessionOverridesById] = useState<Map<string, Record<string, string>>>(() => new Map());

    const [results, setResults] = useState<Map<string, UserDecisionsBundle>>(() => new Map());
    const [pending, setPending] = useState<boolean>(false);
    const [simulationError, setSimulationError] = useState<string>('');
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

    // ── User fetch (search + pagination) ─────────────────────────────────
    // Fetches the candidate user list whenever the search term, page,
    // or scope inputs change. Pre-populates page 0 on mount so the
    // table is non-empty immediately. Strategy:
    //
    //   - Typed search → `searchProfiles` (top-N by relevance, no
    //     pagination — Mattermost's search API doesn't cursor); the
    //     paginator hides while a search term is active.
    //   - Channel scope (no term) → `getProfilesInChannel` with the
    //     current page / page size. The channel roster can omit a
    //     system admin who isn't a member of THIS channel; we merge
    //     the signed-in sysadmin into page 0 when missing so the
    //     author can still pick themselves without scrolling.
    //   - System / no-channel scope (no term) → `getProfiles`
    //     paginated, optionally narrowed to the active team.
    //
    // After the network call we fetch one extra (`PAGE_SIZE + 1`) and
    // expose `hasNextPage` from whether the over-fetch returned the
    // extra row. This avoids a second "total count" round trip — for
    // search the paginator is hidden anyway. We then bulk-fetch
    // channel memberships only when needed (channel scope + a target
    // role) to apply role-chain applicability client-side.
    useEffect(() => {
        let cancelled = false;
        setIsLoadingUsers(true);
        setUsersError('');

        const debounce = searchTerm ? USER_SEARCH_DEBOUNCE_MS : 0;
        const fetchSize = USER_PAGE_SIZE + 1;
        const handle = window.setTimeout(async () => {
            try {
                let raw: UserProfile[];

                if (searchTerm) {
                    const opts: Record<string, any> = {limit: fetchSize};
                    if (teamId) {
                        opts.team_id = teamId;
                    }
                    if (targetScope === 'channel' && channelId) {
                        opts.in_channel_id = channelId;
                    }
                    const action = await dispatch(searchProfiles(searchTerm, opts));
                    if (cancelled) {
                        return;
                    }
                    raw = (action as ActionResult<UserProfile[]>).data ?? [];
                } else if (targetScope === 'channel' && channelId) {
                    const action = await dispatch(
                        getProfilesInChannel(channelId, page, fetchSize),
                    );
                    if (cancelled) {
                        return;
                    }
                    raw = (action as ActionResult<UserProfile[]>).data ?? [];
                } else {
                    const profileOpts: Record<string, any> = {};
                    if (teamId) {
                        profileOpts.in_team = teamId;
                    }
                    const action = await dispatch(
                        getProfiles(page, fetchSize, profileOpts),
                    );
                    if (cancelled) {
                        return;
                    }
                    raw = (action as ActionResult<UserProfile[]>).data ?? [];
                }

                const overFetch = raw.length > USER_PAGE_SIZE;
                let visible = overFetch ? raw.slice(0, USER_PAGE_SIZE) : raw;

                // Pin the signed-in sysadmin to page 0 when missing
                // from the channel roster so they can test the policy
                // against their own session without scrolling. The
                // insertion happens AFTER the over-fetch slice so it
                // never displaces a real channel member off the visible
                // window — the previous version prepended onto `raw`
                // before slicing, which silently dropped the last member
                // of every page-0 sysadmin run. `hasNextPage` is still
                // computed from the un-augmented `raw` length so
                // pagination matches the server cursor exactly.
                if (
                    targetScope === 'channel' &&
                    channelId &&
                    page === 0 &&
                    currentUser &&
                    userIsSystemAdmin(currentUser) &&
                    !visible.some((u) => u.id === currentUser.id)
                ) {
                    visible = [currentUser, ...visible];
                }

                // We deliberately DO NOT filter client-side by
                // applicability (system role / channel role) here.
                // Filtering after server-side pagination produces the
                // "page 1 has 2 admins, page 2 has 3, page 3 has 1"
                // pathology — each fetched window of N members
                // collapses to a different subset, breaking the
                // page-count mental model. Instead we surface every
                // candidate the underlying endpoint returns and let
                // the simulator stamp inapplicable subjects with a
                // `no_applicable_policy` blame, which the picker
                // renders as "Policy doesn't apply" — so authors can
                // still tell which rows their rule doesn't govern,
                // and pagination matches the API page count exactly.
                setUsers(visible);
                setHasNextPage(overFetch && !searchTerm);
                setIsLoadingUsers(false);
            } catch (err) {
                if (cancelled) {
                    return;
                }
                setUsersError(err instanceof Error ? err.message : String(err));
                setUsers([]);
                setHasNextPage(false);
                setIsLoadingUsers(false);
            }
        }, debounce);

        return () => {
            cancelled = true;
            window.clearTimeout(handle);
        };

        // currentUser is intentionally omitted: we only consume it on
        // the page-0 merge and re-running the whole fetch every time
        // the current-user object identity refreshes (Redux store
        // churn) is wasteful. The merge target is stable across the
        // modal lifetime.

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, page, channelId, teamId, targetRole, targetScope, dispatch]);

    // Derived view of the visible rows. Each row pairs the fetched user
    // with any session-attribute overrides the author staged for that
    // user during this modal session — overrides survive
    // search/pagination because they're stored in `sessionOverridesById`
    // and re-applied by id whenever the user list changes.
    const rows = useMemo<RowState[]>(() => users.map((user) => ({
        user,
        sessionOverrides: sessionOverridesById.get(user.id) ?? {},
    })), [users, sessionOverridesById]);

    const runSimulate = useCallback(async (rowList?: RowState[], scopeOverride?: PolicyEvaluationScope) => {
        const list = rowList ?? rows;
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

        // Preserve previously-rendered decisions when the simulator
        // call errors out: wiping `results` to an empty Map would
        // silently swap every chip back to its pristine "no chip"
        // state with no explanation, which reads as a regression.
        // Instead surface the error in a banner above the table and
        // leave the existing data in place so authors can still see
        // the last successful run while we report the failure.
        const actionRes = result as ActionResult<PolicySimulationResponse>;
        if (actionRes.error) {
            const message = actionRes.error instanceof Error ?
                actionRes.error.message :
                String(actionRes.error);
            setSimulationError(message || 'Unknown error');
            setPending(false);
            return;
        }

        const next = new Map<string, UserDecisionsBundle>();
        const data = actionRes.data;
        if (data) {
            for (const r of data.results) {
                if (r.user) {
                    next.set(r.user.id, {decisions: r.decisions, sessions: r.sessions, attributes: r.attributes});
                }
            }
        }
        setSimulationError('');
        setResults(next);
        setPending(false);
    }, [rows, actions, dispatch, policy, ruleName, channelId, teamId, scope]);

    const handleApplyOverrides = useCallback((userId: string, overrides: Record<string, string>) => {
        setSessionOverridesById((prev) => {
            const next = new Map(prev);
            if (Object.keys(overrides).length === 0) {
                next.delete(userId);
            } else {
                next.set(userId, overrides);
            }
            return next;
        });
    }, []);

    // Auto-run the simulator whenever the visible row set changes —
    // a search edit, a page navigation, an override apply, or the
    // initial page-0 fetch. The picker used to require a manual
    // "+ Add users" → click flow before the simulator ever ran; with
    // the data-driven flow, every visible row needs a fresh decision
    // chip the moment it appears, so we kick off `runSimulate`
    // unconditionally. Empty rows short-circuit inside `runSimulate`.
    //
    // We deliberately do NOT depend on `runSimulate` itself (whose
    // identity changes whenever rows do) because that would form a
    // feedback loop. Listing every input that should trigger a
    // re-run keeps the dependency graph explicit. Scope changes go
    // through `handleScopeChange` which dispatches its own re-run.
    useEffect(() => {
        runSimulate(rows);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows]);

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
        if (rows.length > 0) {
            runSimulate(undefined, next);
        }
    }, [scope, rows, runSimulate]);

    const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);

        // Reset to page 0 whenever the term changes — paging through
        // page N of the OLD term's results after searching for a new
        // term would surface unrelated users.
        setPage(0);
    }, []);

    const handlePrevPage = useCallback(() => {
        setPage((p) => Math.max(0, p - 1));
    }, []);

    const handleNextPage = useCallback(() => {
        setPage((p) => p + 1);
    }, []);

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

            // Custom footer hosting only the prev/next pagination
            // (right-aligned). The GenericModal's X close in the
            // top-right serves as the primary dismiss affordance —
            // duplicating it as a footer "Close" button was
            // redundant. The auto-rerun on every search/page/scope/
            // override change makes a manual "Re-run" button likewise
            // redundant. The aggregate "X users · Y allowed · Z
            // denied" summary was also removed: paginated results
            // would only summarize the visible page, which mislead
            // authors into thinking the tally reflected the policy's
            // whole audience.
            //
            // Pagination disappears whole-cloth during typed search
            // (Mattermost's search API returns top-N matches, not a
            // paginated cursor) and when a single page exhausts the
            // result set — the footer then collapses to an empty band.
            footerContent={
                !searchTerm && (page > 0 || hasNextPage) ? (
                    <div
                        className='SimulateAccessModal__footer'
                        data-testid='simulate-access-pagination'
                    >
                        <Button
                            emphasis='tertiary'
                            size='sm'
                            onClick={handlePrevPage}
                            disabled={page === 0 || isLoadingUsers || pending}
                            data-testid='simulate-access-pagination-prev'
                        >
                            <FormattedMessage
                                id='admin.access_control.simulate_access.pagination.previous'
                                defaultMessage='Previous'
                            />
                        </Button>
                        <Button
                            emphasis='tertiary'
                            size='sm'
                            onClick={handleNextPage}
                            disabled={!hasNextPage || isLoadingUsers || pending}
                            data-testid='simulate-access-pagination-next'
                        >
                            <FormattedMessage
                                id='admin.access_control.simulate_access.pagination.next'
                                defaultMessage='Next'
                            />
                        </Button>
                    </div>
                ) : null
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
                        defaultMessage="Search and page through users to evaluate against the selected scope. Each row shows whether the action would be allowed for that user's most recent session."
                    />
                </p>
                <input
                    type='text'
                    className='SimulateAccessModal__search'
                    value={searchTerm}
                    onChange={handleSearchChange}
                    placeholder={formatMessage({
                        id: 'admin.access_control.simulate_access.search_placeholder',
                        defaultMessage: 'Search users',
                    })}
                    aria-label={formatMessage({
                        id: 'admin.access_control.simulate_access.search_aria',
                        defaultMessage: 'Search users to simulate',
                    })}
                    data-testid='simulate-access-search'
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
                {simulationError ? (
                    <div
                        className='SimulateAccessModal__simulateError'
                        data-testid='simulate-access-simulate-error'
                        role='alert'
                    >
                        <FormattedMessage
                            id='admin.access_control.simulate_access.simulate_error'
                            defaultMessage="Couldn't evaluate the policy. Showing the previous results."
                        />
                    </div>
                ) : null}
                {(() => {
                    if (usersError) {
                        return (
                            <div
                                className='SimulateAccessModal__empty SimulateAccessModal__empty--error'
                                data-testid='simulate-access-load-error'
                                role='alert'
                            >
                                <FormattedMessage
                                    id='admin.access_control.simulate_access.load_error'
                                    defaultMessage="Couldn't load users. Try closing and reopening the modal."
                                />
                            </div>
                        );
                    }
                    if (rows.length === 0 && !isLoadingUsers) {
                        return (
                            <div className='SimulateAccessModal__empty'>
                                {searchTerm ? (
                                    <FormattedMessage
                                        id='admin.access_control.simulate_access.no_search_results'
                                        defaultMessage='No users match this search.'
                                    />
                                ) : (
                                    <FormattedMessage
                                        id='admin.access_control.simulate_access.no_candidates'
                                        defaultMessage='No users in scope to simulate against this rule.'
                                    />
                                )}
                            </div>
                        );
                    }
                    return (
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
                                        <>
                                            <th>
                                                <FormattedMessage
                                                    id='admin.access_control.simulate_access.col.recent_activity'
                                                    defaultMessage='Recent activity'
                                                />
                                            </th>
                                            <th>
                                                <span className='sr-only'>
                                                    <FormattedMessage
                                                        id='admin.access_control.simulate_access.col.actions'
                                                        defaultMessage='Actions'
                                                    />
                                                </span>
                                            </th>
                                        </>
                                    ) : null}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
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
                                    />
                                ))}
                            </tbody>
                        </table>
                    );
                })()}

                {/* The paginator now lives in the modal footer (right-
                  * aligned next to the row-count summary) — see the
                  * `footerContent` block above. The body region is
                  * just the table / empty state. */}
            </div>

        </GenericModal>
    );
}

export default SimulateAccessModal;
