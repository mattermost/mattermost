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
import React, {useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import type {UserProfile} from '@mattermost/types/users';

import {getProfiles, getProfilesInChannel, searchProfiles} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import type {ActionResult} from 'mattermost-redux/types/actions';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import Input from 'components/widgets/inputs/input/input';

import {pickChannelRoleFromTokens, userIsSystemAdmin, userMatchesTargetRole} from './role_applicability';
import type {TargetScope} from './role_applicability';

import './add_users_inline.scss';

const USER_SEARCH_LIMIT = 20;
const USER_SEARCH_DEBOUNCE_MS = 200;

type Props = {
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
 * match the rule's targetRole are hidden from the picker. Pre-populate
 * lists channel members only; the signed-in system admin is merged in when
 * missing from that roster so they can still add themselves.
 */
export default function AddUsersInline({onAdd, excludeIdsKey, excludeIds, targetRole, targetScope, teamId, channelId}: Props): JSX.Element {
    const dispatch = useDispatch();
    const currentUser = useSelector(getCurrentUser);
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
            // hasn't typed anything yet — saves them having to type
            // to see ANY result.
            //
            // Channel scope: use channel members only (`getProfilesInChannel`).
            // Plain `getProfiles` + `in_team` is far too broad (often an entire
            // team or worse). Typed search still passes `in_channel_id` so
            // results stay channel-scoped there too.
            //
            // The channel roster can omit a system admin who is not a member
            // record for this channel; merge the signed-in user when they're a
            // sysadmin and missing so authors can still pick themselves without
            // listing everyone.
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

                if (
                    currentUser &&
                    userIsSystemAdmin(currentUser) &&
                    !excludeIdsRef.current.has(currentUser.id) &&
                    !found.some((u) => u.id === currentUser.id)
                ) {
                    found = [currentUser, ...found].slice(0, USER_SEARCH_LIMIT);
                }
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
            // round-trip, then apply role-chain applicability on
            // the client.
            //
            // Sysadmins are NOT bypassed any more — they're put
            // through the same applicability check with their
            // effective channel role pegged to `channel_admin`,
            // matching the live PDP's sysadmin-override semantics:
            // a sysadmin acts as channel admin on every channel.
            // Through the role-chain fallback that means they pass
            // for `channel_admin` and `channel_user` rules but
            // (correctly) fail `channel_guest` checks. Sysadmins
            // who happen to also be channel members get whichever
            // role is reported by the channel membership — the
            // membership lookup wins over the system-admin
            // fallback so a sysadmin recorded as `channel_guest`
            // in this channel evaluates as a guest.
            let memberRoleByUserId = new Map<string, string>();
            try {
                const members = await Client4.getChannelMembersByIds(
                    channelId,
                    candidates.map((u) => u.id),
                );
                if (cancelled) {
                    return;
                }
                memberRoleByUserId = new Map(
                    members.map((m) => [m.user_id, m.roles ?? '']),
                );
            } catch {
                // Best-effort: if the membership lookup fails we
                // fall back to "no channel role" for everyone, which
                // excludes regular members per userMatchesTargetRole
                // semantics. Sysadmins still pass via the
                // system-admin → channel_admin mapping below.
            }

            const filtered = candidates.filter((u) => {
                let channelMemberRole = pickChannelRoleFromTokens(
                    memberRoleByUserId.get(u.id) ?? '',
                );
                if (!channelMemberRole && userIsSystemAdmin(u)) {
                    // Non-member sysadmin: treat as effective
                    // channel admin so the role-chain check still
                    // resolves correctly for admin / user rules.
                    channelMemberRole = 'channel_admin';
                }
                return userMatchesTargetRole(u, targetRole, 'channel', channelMemberRole);
            });

            setResults(filtered);
            setLoading(false);
        }, debounce);

        return () => {
            cancelled = true;
            window.clearTimeout(handle);
        };
    }, [open, term, dispatch, excludeIdsKey, targetRole, targetScope, teamId, channelId, currentUser]);

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
            <Button
                ref={refs.setReference}
                id='simulateAccessAddUsers'
                size='sm'
                aria-label={formatMessage({id: 'admin.access_control.simulate_access.add_users', defaultMessage: 'Add users'})}
                className='SimulateAccessModal__addUsers'
                {...getReferenceProps()}
            >
                <i className='icon icon-plus'/>
                <FormattedMessage
                    id='admin.access_control.simulate_access.add_users'
                    defaultMessage='Add users'
                />
            </Button>
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
