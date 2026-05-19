// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import './channel_invite_modal.scss';

import isEqual from 'lodash/isEqual';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {IntlShape} from 'react-intl';
import {injectIntl, FormattedMessage, defineMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';
import type {Group, GroupSearchParams} from '@mattermost/types/groups';
import type {TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';
import type {ActionResult} from 'mattermost-redux/types/actions';
import {filterGroupsMatchingTerm} from 'mattermost-redux/utils/group_utils';
import {displayUsername, filterProfilesStartingWithTerm, isGuest} from 'mattermost-redux/utils/user_utils';

import AlertBanner from 'components/alert_banner';
import useAccessControlAttributes, {EntityType} from 'components/common/hooks/useAccessControlAttributes';
import InvitationModal from 'components/invitation_modal';
import MultiSelect from 'components/multiselect/multiselect';
import type {Value} from 'components/multiselect/multiselect';
import ProfilePicture from 'components/profile_picture';
import ToggleModalButton from 'components/toggle_modal_button';
import AlertTag from 'components/widgets/tag/alert_tag';
import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';
import TagGroup from 'components/widgets/tag/tag_group';

import Constants, {ModalIdentifiers} from 'utils/constants';
import {formatAttributeName} from 'utils/format_attribute_name';
import {sortUsersAndGroups} from 'utils/utils';

import GroupOption from './group_option';
import TeamWarningBanner from './team_warning_banner';

const USERS_PER_PAGE = 50;
const USERS_FROM_DMS = 10;
const MAX_USERS = 25;

type UserProfileValue = Value & UserProfile;

type GroupValue = Value & Group;

export type Props = {
    profilesNotInCurrentChannel: UserProfile[];
    profilesInCurrentChannel: UserProfile[];
    profilesNotInCurrentTeam: UserProfile[];
    profilesFromRecentDMs: UserProfile[];
    intl: IntlShape;
    membersInTeam?: RelationOneToOne<UserProfile, TeamMembership>;
    userStatuses: RelationOneToOne<UserProfile, string>;
    onExited: () => void;
    channel: Channel;
    teammateNameDisplaySetting: string;

    // skipCommit = true used with onAddCallback will result in users not being committed immediately
    skipCommit?: boolean;

    // onAddCallback takes an array of UserProfiles and should set usersToAdd in state of parent component
    onAddCallback?: (userProfiles?: UserProfileValue[]) => void;

    // Dictionaries of userid mapped users to exclude or include from this list
    excludeUsers?: Record<string, UserProfileValue>;
    includeUsers?: Record<string, UserProfileValue>;
    canInviteGuests?: boolean;
    emailInvitationsEnabled?: boolean;
    groups: Group[];
    isGroupsEnabled: boolean;
    actions: {
        addUsersToChannel: (channelId: string, userIds: string[]) => Promise<ActionResult>;
        getProfilesNotInChannel: (teamId: string, channelId: string, groupConstrained: boolean, page: number, perPage?: number, cursorId?: string) => Promise<ActionResult>;
        getProfilesInChannel: (channelId: string, page: number, perPage: number, sort: string, options: {active?: boolean}) => Promise<ActionResult>;
        getTeamStats: (teamId: string) => void;
        loadStatusesForProfilesList: (users: UserProfile[]) => void;
        searchProfiles: (term: string, options: any) => Promise<ActionResult>;
        closeModal: (modalId: string) => void;
        searchAssociatedGroupsForReference: (prefix: string, teamId: string, channelId: string | undefined, opts: GroupSearchParams) => Promise<ActionResult>;
        getTeamMembersByIds: (teamId: string, userIds: string[]) => Promise<ActionResult>;
    };
}

// Helper function to check if an option is a user
const isUser = (option: UserProfileValue | GroupValue): option is UserProfileValue => {
    return (option as UserProfile).username !== undefined;
};

const ChannelInviteModalComponent = (props: Props) => {
    const [selectedUsers, setSelectedUsers] = useState<UserProfileValue[]>([]);
    const [usersNotInTeam, setUsersNotInTeam] = useState<UserProfileValue[]>([]);
    const [guestsNotInTeam, setGuestsNotInTeam] = useState<UserProfileValue[]>([]);
    const [term, setTerm] = useState('');
    const [show, setShow] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [groupAndUserOptions, setGroupAndUserOptions] = useState<Array<UserProfileValue | GroupValue>>([]);
    const [inviteError, setInviteError] = useState<string | undefined>(undefined);
    const [pageCursors, setPageCursors] = useState<{[page: number]: string}>({});
    const [abacFilteredUsers, setAbacFilteredUsers] = useState<UserProfile[]>([]);

    /** Server ABAC search hits when the user types a term on private policy-enforced channels (see Client4.searchUsers). Null means use {@link abacFilteredUsers} instead. */
    const [privateAbacSearchHits, setPrivateAbacSearchHits] = useState<UserProfile[] | null>(null);
    const [recommendedUserIds, setRecommendedUserIds] = useState<Set<string>>(new Set());

    const searchTimeoutId = useRef<number>(0);
    const selectedItemRef = useRef<HTMLDivElement>(null);
    const privateAbacSearchSeq = useRef<number>(0);

    // Monotonic token for fetchRecommendedUserIds — incremented every time we
    // start a fresh fetch (or the channel changes). The pagination loop reads
    // its captured token before each step and aborts/skips state writes when
    // it sees a newer token, so a stale response from a prior channel can't
    // overwrite recommendations for the current one.
    const recommendedUserIdsRequestId = useRef<number>(0);

    // Monotonic token for fetchAbacUsers — stale HTTP responses must not
    // overwrite abacFilteredUsers after the user switches channels.
    const abacProfilesFetchRequestId = useRef<number>(0);

    // Public channels with a policy are advisory — the invite list is not
    // filtered and matching users are merely surfaced as a recommendation.
    // Private channels with a policy remain a hard gate.
    const isPolicyEnforcedPrivate = props.channel.policy_enforced && props.channel.type !== Constants.OPEN_CHANNEL;
    const isPolicyRecommendedPublic = props.channel.policy_enforced && props.channel.type === Constants.OPEN_CHANNEL;

    // Use the useAccessControlAttributes hook
    const {structuredAttributes} = useAccessControlAttributes(
        EntityType.Channel,
        props.channel.id,
        props.channel.policy_enforced,
    );

    // Memoise the rendered access-control tags so they don't re-render on
    // every keystroke in the invite text box.
    const accessControlTags = useMemo(() => {
        if (structuredAttributes.length === 0) {
            return null;
        }
        return (
            <TagGroup>
                {structuredAttributes.flatMap((attribute) =>
                    attribute.values.map((value) => {
                        const attributeLabel = formatAttributeName(attribute.name);
                        return (
                            <AlertTag
                                key={`${attribute.name}-${value}`}
                                tooltipTitle={attributeLabel}
                                text={`${attributeLabel}: ${value}`}
                            />
                        );
                    }),
                )}
            </TagGroup>
        );
    }, [structuredAttributes]);

    // Helper function to add a user or group to the selected list
    const addValue = useCallback((value: UserProfileValue | GroupValue) => {
        if (isUser(value)) {
            const profile = value;
            if (!props.membersInTeam || !props.membersInTeam[profile.id]) {
                if (isGuest(profile.roles)) {
                    setGuestsNotInTeam((prevState) => {
                        if (prevState.findIndex((p) => p.id === profile.id) === -1) {
                            return [...prevState, profile];
                        }
                        return prevState;
                    });
                    return;
                }
                setUsersNotInTeam((prevState) => {
                    if (prevState.findIndex((p) => p.id === profile.id) === -1) {
                        return [...prevState, profile];
                    }
                    return prevState;
                });
                return;
            }

            setSelectedUsers((prevState) => {
                if (prevState.findIndex((p) => p.id === profile.id) === -1) {
                    return [...prevState, profile];
                }
                return prevState;
            });
        }
    }, [props.membersInTeam, isGuest]);

    // Get excluded users
    const excludedUsers = useMemo(() => {
        if (props.excludeUsers) {
            return new Set([
                ...props.profilesNotInCurrentTeam.map((user) => user.id),
                ...Object.values(props.excludeUsers).map((user) => user.id),
            ]);
        }
        return new Set(props.profilesNotInCurrentTeam.map((user) => user.id));
    }, [props.excludeUsers, props.profilesNotInCurrentTeam]);

    // Filter out deleted and excluded users
    const filterOutDeletedAndExcludedAndNotInTeamUsers = useCallback((users: UserProfile[], excludeUserIds: Set<string>): UserProfileValue[] => {
        return users.filter((user) => {
            return user.delete_at === 0 && !excludeUserIds.has(user.id);
        }) as UserProfileValue[];
    }, []);

    // Get options for the multiselect
    const getOptions = useCallback(() => {
        const excludedAndNotInTeamUserIds = excludedUsers;

        // DM users and include_users are suppressed only for the hard-gated
        // private policy path, since public policies are purely advisory.
        let dmUsers: UserProfileValue[] = [];
        if (!isPolicyEnforcedPrivate) {
            const filteredDmUsers = filterProfilesStartingWithTerm(props.profilesFromRecentDMs, term);
            dmUsers = filterOutDeletedAndExcludedAndNotInTeamUsers(filteredDmUsers, excludedAndNotInTeamUserIds).slice(0, USERS_FROM_DMS) as UserProfileValue[];
        }

        let users: UserProfileValue[];
        if (isPolicyEnforcedPrivate) {
            const sourceList =
                term.trim().length > 0 ?
                    (privateAbacSearchHits ?? []) :
                    abacFilteredUsers;
            users = filterOutDeletedAndExcludedAndNotInTeamUsers(sourceList, excludedAndNotInTeamUserIds);
        } else {
            // Non-ABAC or advisory (public policy): full team list.
            const filteredUsers = filterProfilesStartingWithTerm(props.profilesNotInCurrentChannel.concat(props.profilesInCurrentChannel), term);
            users = filterOutDeletedAndExcludedAndNotInTeamUsers(filteredUsers, excludedAndNotInTeamUserIds);

            if (props.includeUsers) {
                users = [...users, ...Object.values(props.includeUsers)];
            }
        }

        // Groups are suppressed only for the hard-gated private ABAC path.
        const groupsAndUsers = [
            ...(isPolicyEnforcedPrivate ? [] : filterGroupsMatchingTerm(props.groups, term) as GroupValue[]),
            ...users,
        ].sort(sortUsersAndGroups);

        let optionValues: Array<UserProfileValue | GroupValue> = [
            ...dmUsers,
            ...groupsAndUsers,
        ];

        // For advisory (public) policies, boost recommended users to the top
        // while keeping the rest of the order stable.
        if (isPolicyRecommendedPublic && recommendedUserIds.size > 0) {
            const recommended: Array<UserProfileValue | GroupValue> = [];
            const rest: Array<UserProfileValue | GroupValue> = [];
            for (const opt of optionValues) {
                if (isUser(opt) && recommendedUserIds.has(opt.id)) {
                    recommended.push(opt);
                } else {
                    rest.push(opt);
                }
            }
            optionValues = [...recommended, ...rest];
        }

        return Array.from(new Set(optionValues.slice(0, MAX_USERS)));
    }, [
        term,
        props.profilesFromRecentDMs,
        props.profilesNotInCurrentChannel,
        props.profilesInCurrentChannel,
        props.includeUsers,
        props.groups,
        isPolicyEnforcedPrivate,
        isPolicyRecommendedPublic,
        recommendedUserIds,
        excludedUsers,
        filterOutDeletedAndExcludedAndNotInTeamUsers,
        abacFilteredUsers,
        privateAbacSearchHits,
    ]);

    // Handle modal hide
    const onHide = useCallback(() => {
        setShow(false);
        props.actions.loadStatusesForProfilesList(props.profilesNotInCurrentChannel);
        props.actions.loadStatusesForProfilesList(props.profilesInCurrentChannel);
    }, [props.actions, props.profilesNotInCurrentChannel, props.profilesInCurrentChannel]);

    // Handle invite error
    const handleInviteError = useCallback((err: any) => {
        if (err) {
            setSaving(false);
            setInviteError(err.message);
        }
    }, []);

    // Handle delete (removing users from selection)
    const handleDelete = useCallback((values: Array<UserProfileValue | GroupValue>) => {
        // Our values for this component are always UserProfileValue
        const profiles = values as UserProfileValue[];
        setSelectedUsers(profiles);
    }, []);

    // Set users loading state
    const setUsersLoadingState = useCallback((loadingState: boolean) => {
        setLoadingUsers(loadingState);
    }, []);

    // Custom function to fetch ABAC users without polluting Redux store.
    // Used only for the private (hard-gated) policy path.
    //
    // The first call (page 0, no cursor) replaces the buffer; subsequent
    // calls append (deduped by id) so paging through the policy-filtered
    // list grows the in-memory buffer that getOptions() searches over.
    // We can't merge with Redux profile lists here because the global
    // search/profile actions don't apply the ABAC server-side filter, and
    // doing so would surface non-matching users in the strict-gate UI.
    const fetchAbacUsers = useCallback(async (page = 0, perPage = USERS_PER_PAGE, cursorId = '') => {
        const requestId = ++abacProfilesFetchRequestId.current;
        const isInitialLoad = page === 0 && !cursorId;
        try {
            const profiles = await Client4.getProfilesNotInChannel(
                props.channel.team_id,
                props.channel.id,
                props.channel.group_constrained,
                page,
                perPage,
                cursorId,
            );
            if (requestId !== abacProfilesFetchRequestId.current) {
                return {data: profiles || []};
            }
            if (isInitialLoad) {
                setAbacFilteredUsers(profiles || []);
            } else if (profiles && profiles.length > 0) {
                setAbacFilteredUsers((prev) => {
                    const seen = new Set(prev.map((u) => u.id));
                    const additions = profiles.filter((u) => !seen.has(u.id));
                    return additions.length > 0 ? [...prev, ...additions] : prev;
                });
            }
            return {data: profiles || []};
        } catch (error) {
            if (requestId !== abacProfilesFetchRequestId.current) {
                return {error};
            }
            if (isInitialLoad) {
                setAbacFilteredUsers([]);
            }
            return {error};
        }
    }, [props.channel.team_id, props.channel.id, props.channel.group_constrained]);

    // For advisory (public) policies, fetch the matching-user subset to
    // render a subtle "Recommended" indicator and boost them to the top.
    // This bypasses Redux so the normal (unfiltered) list remains intact.
    //
    // Uses the cursor-based pagination on getProfilesMatchingChannelPolicy
    // to walk every page of matching users; otherwise users beyond the
    // first page would never be tagged as recommended. Capped to keep the
    // tag-rendering set bounded for very large teams.
    const fetchRecommendedUserIds = useCallback(async () => {
        const RECOMMENDED_HARD_CAP = 1000;
        const requestId = ++recommendedUserIdsRequestId.current;
        try {
            const ids = new Set<string>();
            let cursorId = '';
            // eslint-disable-next-line no-constant-condition
            while (true) {
                // eslint-disable-next-line no-await-in-loop
                const profiles = await Client4.getProfilesMatchingChannelPolicy(
                    props.channel.team_id,
                    props.channel.id,
                    props.channel.group_constrained,
                    USERS_PER_PAGE,
                    cursorId,
                );

                // A newer fetch (or channel switch) bumped the token; bail
                // before doing more work or writing stale results to state.
                if (recommendedUserIdsRequestId.current !== requestId) {
                    return;
                }
                if (!profiles || profiles.length === 0) {
                    break;
                }
                for (const u of profiles) {
                    ids.add(u.id);
                }
                if (profiles.length < USERS_PER_PAGE || ids.size >= RECOMMENDED_HARD_CAP) {
                    break;
                }
                cursorId = profiles[profiles.length - 1].id;
            }
            if (recommendedUserIdsRequestId.current === requestId) {
                setRecommendedUserIds(ids);
            }
        } catch {
            if (recommendedUserIdsRequestId.current === requestId) {
                setRecommendedUserIds(new Set());
            }
        }
    }, [props.channel.team_id, props.channel.id, props.channel.group_constrained]);

    // Handle page change with cursor-based pagination
    const handlePageChange = useCallback((page: number, prevPage: number) => {
        if (page > prevPage) {
            setUsersLoadingState(true);

            // Get cursor for this page (if we're going forward)
            const cursorId = page > 0 ? pageCursors[page - 1] : '';

            // Private ABAC channels page through Client4 directly so the
            // result lands in our scoped abacFilteredUsers buffer that
            // getOptions() reads from. Routing through Redux here would
            // populate profilesNotInCurrentChannel which getOptions ignores
            // on the strict-gate path, leaving subsequent pages invisible.
            const fetchPage = isPolicyEnforcedPrivate ?
                fetchAbacUsers(page + 1, USERS_PER_PAGE, cursorId) :
                props.actions.getProfilesNotInChannel(
                    props.channel.team_id,
                    props.channel.id,
                    props.channel.group_constrained,
                    page + 1,
                    USERS_PER_PAGE,
                    cursorId,
                );

            fetchPage.then((result) => {
                // Store the cursor for the next page (ID of the last user)
                if (result.data && result.data.length > 0) {
                    const lastUserId = result.data[result.data.length - 1].id;
                    setPageCursors((prev) => ({
                        ...prev,
                        [page]: lastUserId,
                    }));
                }
                setUsersLoadingState(false);
            }).catch(() => {
                setUsersLoadingState(false);
            });

            // Existing channel members are only relevant outside the strict
            // ABAC path — its in-channel listing comes from policy data, not
            // from the global Redux profile lists.
            if (!isPolicyEnforcedPrivate) {
                props.actions.getProfilesInChannel(props.channel.id, page + 1, USERS_PER_PAGE, '', {active: true});
            }
        }
    }, [props.actions, props.channel, setUsersLoadingState, pageCursors, setPageCursors, isPolicyEnforcedPrivate, fetchAbacUsers]);

    // Handle form submission
    const handleSubmit = useCallback(() => {
        const {actions, channel} = props;

        const userIds = selectedUsers.map((u) => u.id);
        if (userIds.length === 0) {
            return;
        }

        if (props.skipCommit && props.onAddCallback) {
            props.onAddCallback(selectedUsers);
            setSaving(false);
            setInviteError(undefined);
            onHide();
            return;
        }

        setSaving(true);

        actions.addUsersToChannel(channel.id, userIds).then((result) => {
            if (result.error) {
                handleInviteError(result.error);
            } else {
                setSaving(false);
                setInviteError(undefined);
                onHide();
            }
        });
    }, [props, selectedUsers, handleInviteError, onHide]);

    // Handle search
    const search = useCallback((searchTerm: string) => {
        const term = searchTerm.trim();
        clearTimeout(searchTimeoutId.current);
        setTerm(term);

        if (!term) {
            // Reset cursor state when clearing search
            setPageCursors({});
            setPrivateAbacSearchHits(null);
            setUsersLoadingState(false);
            return;
        }

        searchTimeoutId.current = window.setTimeout(
            async () => {
                if (isPolicyEnforcedPrivate) {
                    privateAbacSearchSeq.current++;
                    const seq = privateAbacSearchSeq.current;
                    setUsersLoadingState(true);
                    try {
                        const profiles = await Client4.searchUsers(term, {
                            team_id: props.channel.team_id,
                            not_in_channel_id: props.channel.id,
                            group_constrained: Boolean(props.channel.group_constrained),
                            limit: 100,
                        });
                        if (seq === privateAbacSearchSeq.current) {
                            setPrivateAbacSearchHits(profiles || []);
                        }
                    } catch {
                        if (seq === privateAbacSearchSeq.current) {
                            setPrivateAbacSearchHits([]);
                        }
                    } finally {
                        if (seq === privateAbacSearchSeq.current) {
                            setUsersLoadingState(false);
                        }
                    }
                    return;
                }

                const options = {
                    team_id: props.channel.team_id,
                    not_in_channel_id: props.channel.id,
                    group_constrained: Boolean(props.channel.group_constrained),
                };

                const opts = {
                    q: term,
                    filter_allow_reference: true,
                    page: 0,
                    per_page: 100,
                    include_member_count: true,
                    include_member_ids: true,
                };

                const promises = [
                    props.actions.searchProfiles(term, options),
                ];

                if (props.isGroupsEnabled) {
                    promises.push(props.actions.searchAssociatedGroupsForReference(term, props.channel.team_id, props.channel.id, opts));
                }
                await Promise.all(promises);
                setUsersLoadingState(false);
            },
            Constants.SEARCH_TIMEOUT_MILLISECONDS,
        );
    }, [props.actions, props.channel, props.isGroupsEnabled, isPolicyEnforcedPrivate, setUsersLoadingState]);

    // Render aria label for options
    const renderAriaLabel = useCallback((option: UserProfileValue | GroupValue): string => {
        if (!option) {
            return '';
        }
        if (isUser(option)) {
            return option.username;
        }
        return option.name;
    }, []);

    // Render option for multiselect
    const renderOption = useCallback((option: UserProfileValue | GroupValue, isSelected: boolean, onAdd: (option: UserProfileValue | GroupValue) => void, onMouseMove: (option: UserProfileValue | GroupValue) => void) => {
        let rowSelected = '';
        if (isSelected) {
            rowSelected = 'more-modal__row--selected';
        }

        if (isUser(option)) {
            const ProfilesInGroup = props.profilesInCurrentChannel.map((user) => user.id);

            const userMapping: Record<string, string> = {};
            for (let i = 0; i < ProfilesInGroup.length; i++) {
                userMapping[ProfilesInGroup[i]] = 'Already in channel';
            }
            const displayName = displayUsername(option, props.teammateNameDisplaySetting);
            const isRecommended = isPolicyRecommendedPublic && recommendedUserIds.has(option.id);
            return (
                <div
                    key={option.id}
                    ref={isSelected ? selectedItemRef : undefined}
                    className={'more-modal__row clickable ' + rowSelected}
                    onClick={() => onAdd(option)}
                    onMouseMove={() => onMouseMove(option)}
                >
                    <ProfilePicture
                        src={Client4.getProfilePictureUrl(option.id, option.last_picture_update)}
                        status={props.userStatuses[option.id]}
                        size='md'
                        username={option.username}
                    />
                    <div className='more-modal__details'>
                        <div className='more-modal__name'>
                            <span>
                                {displayName}
                                {option.is_bot && <BotTag/>}
                                {isGuest(option.roles) && <GuestTag className='popoverlist'/>}
                                {displayName === option.username ? null : <span className='channel-invite__username ml-2 light'>
                                    {'@'}{option.username}
                                </span>
                                }
                                {isRecommended && (
                                    <AlertTag
                                        className='channel-invite__recommended-tag'
                                        text={props.intl.formatMessage({
                                            id: 'channel_invite.recommended_tag',
                                            defaultMessage: 'Recommended',
                                        })}
                                        tooltipTitle={props.intl.formatMessage({
                                            id: 'channel_invite.recommended_tag.tooltip',
                                            defaultMessage: 'Matches the suggested membership for this channel',
                                        })}
                                    />
                                )}
                                <span
                                    className='channel-invite__user-mapping light'
                                >
                                    {userMapping[option.id]}
                                </span>
                            </span>
                        </div>
                    </div>
                    <div className='more-modal__actions'>
                        <button
                            className='more-modal__actions--round'
                            aria-label='Add channel to invite'
                        >
                            <i
                                className='icon icon-plus'
                            />
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <GroupOption
                group={option}
                key={option.id}
                addUserProfile={onAdd}
                isSelected={isSelected}
                rowSelected={rowSelected}
                onMouseMove={onMouseMove}
                selectedItemRef={selectedItemRef}
            />
        );
    }, [props.profilesInCurrentChannel, props.teammateNameDisplaySetting, props.userStatuses, props.intl, isPolicyRecommendedPublic, recommendedUserIds]);

    // Initial data loading - only run when channel changes or component mounts
    useEffect(() => {
        privateAbacSearchSeq.current++;
        setAbacFilteredUsers([]);
        setRecommendedUserIds(new Set());
        setPrivateAbacSearchHits(null);
        setPageCursors({});
        setUsersLoadingState(true);

        if (isPolicyEnforcedPrivate) {
            // Hard-gate ABAC: avoid Redux store pollution; only matching users.
            fetchAbacUsers().then(() => {
                setUsersLoadingState(false);
            });
        } else {
            // Non-ABAC or advisory (public) policy: fetch the full team list
            // via the standard Redux action. The server returns the unfiltered
            // list for public policy-enforced channels.
            props.actions.getProfilesNotInChannel(
                props.channel.team_id,
                props.channel.id,
                props.channel.group_constrained,
                0,
                USERS_PER_PAGE,
            ).then(() => {
                setUsersLoadingState(false);
            });

            if (isPolicyRecommendedPublic) {
                fetchRecommendedUserIds();
            }
        }

        props.actions.getProfilesInChannel(props.channel.id, 0, USERS_PER_PAGE, '', {active: true});
        props.actions.getTeamStats(props.channel.team_id);
        props.actions.loadStatusesForProfilesList(props.profilesNotInCurrentChannel);
        props.actions.loadStatusesForProfilesList(props.profilesInCurrentChannel);

        // Bump the request token on dep change / unmount so any in-flight
        // fetchRecommendedUserIds (queued from a prior channel) sees a newer
        // token and discards its results before they reach setState. Covers
        // the cases the in-fetch token alone can't: switching from public to
        // private (no new fetch is started, but the old one is still running)
        // and modal unmount.
        return () => {
            recommendedUserIdsRequestId.current++;
            abacProfilesFetchRequestId.current++;
        };
    }, [
        props.channel.id,
        props.channel.team_id,
        props.channel.group_constrained,
        isPolicyEnforcedPrivate,
        isPolicyRecommendedPublic,
        props.actions,
        fetchAbacUsers,
        fetchRecommendedUserIds,
    ]);

    // Compute options with useMemo to ensure they're always fresh
    const computedOptions = useMemo(() => getOptions(), [
        term,
        props.profilesFromRecentDMs,
        props.profilesNotInCurrentChannel,
        props.profilesInCurrentChannel,
        props.includeUsers,
        props.groups,
        props.profilesNotInCurrentTeam,
        props.excludeUsers,
        isPolicyEnforcedPrivate,
        isPolicyRecommendedPublic,
        recommendedUserIds,
        abacFilteredUsers,
        privateAbacSearchHits,
    ]);

    // Update team members when options change
    useEffect(() => {
        const userIds: string[] = [];

        for (let index = 0; index < computedOptions.length; index++) {
            const newValue = computedOptions[index];
            if (isUser(newValue)) {
                userIds.push(newValue.id);
            } else if (newValue.member_ids) {
                userIds.push(...newValue.member_ids);
            }
        }

        if (!isEqual(computedOptions, groupAndUserOptions)) {
            if (userIds.length > 0) {
                props.actions.getTeamMembersByIds(props.channel.team_id, userIds);
            }
            setGroupAndUserOptions(computedOptions);
        }
    }, [computedOptions, props.actions, props.channel.team_id]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearTimeout(searchTimeoutId.current);
        };
    }, []);

    // Render the component
    const buttonSubmitText = defineMessage({id: 'multiselect.add', defaultMessage: 'Add'});
    const buttonSubmitLoadingText = defineMessage({id: 'multiselect.adding', defaultMessage: 'Adding...'});

    const closeMembersInviteModal = () => {
        props.actions.closeModal(ModalIdentifiers.CHANNEL_INVITE);
    };

    const InviteModalLink = (props: {inviteAsGuest?: boolean; children: React.ReactNode; id?: string; abacChannelPolicyEnforced?: boolean}) => {
        return (
            <ToggleModalButton
                className={`${props.inviteAsGuest ? 'invite-as-guest' : ''} btn btn-link`}
                modalId={ModalIdentifiers.INVITATION}
                dialogType={InvitationModal}
                dialogProps={{
                    channelToInvite: channel,
                    initialValue: term,
                    inviteAsGuest: props.inviteAsGuest,
                    focusOriginElement: 'customNoOptionsMessageLink',
                    canInviteGuests: Boolean(!props.abacChannelPolicyEnforced),
                }}
                onClick={closeMembersInviteModal}
                id={props.id}
            >
                {props.children}
            </ToggleModalButton>
        );
    };

    const customNoOptionsMessage = (
        <div
            className='custom-no-options-message'
        >
            <FormattedMessage
                id='channel_invite.no_options_message'
                defaultMessage='No matches found - <InvitationModalLink>Invite them to the team</InvitationModalLink>'
                values={{
                    InvitationModalLink: (chunks) => (
                        <InviteModalLink
                            id='customNoOptionsMessageLink'
                            abacChannelPolicyEnforced={isPolicyEnforcedPrivate}
                        >
                            {chunks}
                        </InviteModalLink>
                    ),
                }}
            />
        </div>
    );

    const content = (
        <MultiSelect
            key='addUsersToChannelKey'
            options={groupAndUserOptions}
            optionRenderer={renderOption}
            intl={props.intl}
            selectedItemRef={selectedItemRef}
            values={selectedUsers}
            ariaLabelRenderer={renderAriaLabel}
            saveButtonPosition={'bottom'}
            perPage={USERS_PER_PAGE}
            handlePageChange={handlePageChange}
            handleInput={search}
            handleDelete={handleDelete}
            handleAdd={addValue}
            handleSubmit={handleSubmit}
            handleCancel={closeMembersInviteModal}
            buttonSubmitText={buttonSubmitText}
            buttonSubmitLoadingText={buttonSubmitLoadingText}
            saving={saving}
            loading={loadingUsers}
            placeholderText={props.isGroupsEnabled ? defineMessage({id: 'multiselect.placeholder.peopleOrGroups', defaultMessage: 'Search for people or groups'}) : defineMessage({id: 'multiselect.placeholder', defaultMessage: 'Search for people'})}
            valueWithImage={true}
            backButtonText={defineMessage({id: 'multiselect.cancel', defaultMessage: 'Cancel'})}
            backButtonClick={closeMembersInviteModal}
            customNoOptionsMessage={props.emailInvitationsEnabled ? customNoOptionsMessage : null}
        />
    );

    const inviteGuestLink = (
        <InviteModalLink inviteAsGuest={true}>
            <FormattedMessage
                id='channel_invite.invite_guest'
                defaultMessage='Invite as a Guest'
            />
        </InviteModalLink>
    );

    const {channel} = props;

    return (
        <GenericModal
            id='addUsersToChannelModal'
            className='channel-invite'
            show={show}
            onHide={onHide}
            onExited={props.onExited}
            modalHeaderText={
                <FormattedMessage
                    id='channel_invite.addNewMembers'
                    defaultMessage='Add people to {channel}'
                    values={{
                        channel: channel.display_name,
                    }}
                />
            }
            compassDesign={true}
            bodyOverflowVisible={true}
        >
            <div className='channel-invite__wrapper'>
                {inviteError && <label className='has-error control-label'>{inviteError}</label>}
                {(channel.policy_enforced) && (
                    <div className='channel-invite__policy-banner'>
                        <AlertBanner
                            mode='info'
                            variant='app'
                            title={channel.type === Constants.OPEN_CHANNEL ? (
                                <FormattedMessage
                                    id='channel_invite.policy_recommended.title'
                                    defaultMessage='This channel has recommended members based on user attributes'
                                />
                            ) : (
                                <FormattedMessage
                                    id='channel_invite.policy_enforced.title'
                                    defaultMessage='Channel access is restricted by user attributes'
                                />
                            )}
                            message={channel.type === Constants.OPEN_CHANNEL ? (
                                <FormattedMessage
                                    id='channel_invite.policy_recommended.description'
                                    defaultMessage='A membership policy suggests who should be members of this channel. You can still add anyone who can join a public channel.'
                                />
                            ) : (
                                <FormattedMessage
                                    id='channel_invite.policy_enforced.description'
                                    defaultMessage='Only people who match the specified access rules can be selected and added to this channel.'
                                />
                            )}
                        >
                            {accessControlTags}
                        </AlertBanner>
                    </div>
                )}
                <div className='channel-invite__content'>
                    {content}
                    <TeamWarningBanner
                        guests={guestsNotInTeam}
                        teamId={channel.team_id}
                        users={usersNotInTeam}
                    />
                    {(props.emailInvitationsEnabled && props.canInviteGuests && !isPolicyEnforcedPrivate) && inviteGuestLink}
                </div>
            </div>
        </GenericModal>
    );
};

export default injectIntl(ChannelInviteModalComponent);
