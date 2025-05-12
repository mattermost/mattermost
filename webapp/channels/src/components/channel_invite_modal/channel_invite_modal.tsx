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
        getProfilesNotInChannel: (teamId: string, channelId: string, groupConstrained: boolean, page: number, perPage?: number) => Promise<ActionResult>;
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

    const searchTimeoutId = useRef<number>(0);
    const selectedItemRef = useRef<HTMLDivElement>(null);

    // Use the useAccessControlAttributes hook
    const {structuredAttributes} = useAccessControlAttributes(
        EntityType.Channel,
        props.channel.id,
        props.channel.policy_enforced,
    );

    // Helper function to format attribute names for tooltips
    const formatAttributeName = (name: string): string => {
        // Convert snake_case or camelCase to Title Case with spaces
        return name.
            replace(/_/g, ' ').
            replace(/([A-Z])/g, ' $1').
            replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
    };

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

        const filteredDmUsers = filterProfilesStartingWithTerm(props.profilesFromRecentDMs, term);
        const dmUsers = filterOutDeletedAndExcludedAndNotInTeamUsers(filteredDmUsers, excludedAndNotInTeamUserIds).slice(0, USERS_FROM_DMS) as UserProfileValue[];

        let users: UserProfileValue[];
        const filteredUsers: UserProfile[] = filterProfilesStartingWithTerm(props.profilesNotInCurrentChannel.concat(props.profilesInCurrentChannel), term);
        users = filterOutDeletedAndExcludedAndNotInTeamUsers(filteredUsers, excludedAndNotInTeamUserIds);
        if (props.includeUsers) {
            users = [...users, ...Object.values(props.includeUsers)];
        }
        const groupsAndUsers = [
            ...filterGroupsMatchingTerm(props.groups, term) as GroupValue[],
            ...users,
        ].sort(sortUsersAndGroups);

        const optionValues = [
            ...dmUsers,
            ...groupsAndUsers,
        ].slice(0, MAX_USERS);

        return Array.from(new Set(optionValues));
    }, [
        term,
        props.profilesFromRecentDMs,
        props.profilesNotInCurrentChannel,
        props.profilesInCurrentChannel,
        props.includeUsers,
        props.groups,
        excludedUsers,
        filterOutDeletedAndExcludedAndNotInTeamUsers,
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

    // Handle page change
    const handlePageChange = useCallback((page: number, prevPage: number) => {
        if (page > prevPage) {
            setUsersLoadingState(true);
            props.actions.getProfilesNotInChannel(
                props.channel.team_id,
                props.channel.id,
                props.channel.group_constrained,
                page + 1, USERS_PER_PAGE).then(() => setUsersLoadingState(false));

            props.actions.getProfilesInChannel(props.channel.id, page + 1, USERS_PER_PAGE, '', {active: true});
        }
    }, [props.actions, props.channel, setUsersLoadingState]);

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
            // If the search term is empty, don't make any API calls
            setUsersLoadingState(false);
            return;
        }

        searchTimeoutId.current = window.setTimeout(
            async () => {
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
    }, [props.actions, props.channel, props.isGroupsEnabled, setUsersLoadingState]);

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
    }, [props.profilesInCurrentChannel, props.teammateNameDisplaySetting, props.userStatuses]);

    // Initial data loading - only run when channel changes or component mounts
    useEffect(() => {
        props.actions.getProfilesNotInChannel(props.channel.team_id, props.channel.id, props.channel.group_constrained, 0).then(() => {
            setUsersLoadingState(false);
        });
        props.actions.getProfilesInChannel(props.channel.id, 0, USERS_PER_PAGE, '', {active: true});
        props.actions.getTeamStats(props.channel.team_id);
        props.actions.loadStatusesForProfilesList(props.profilesNotInCurrentChannel);
        props.actions.loadStatusesForProfilesList(props.profilesInCurrentChannel);
    }, [
        props.channel.id,
        props.channel.team_id,
        props.channel.group_constrained,
        props.actions,

        // Removing these dependencies as they cause an infinite loop
        // These profiles are updated by the actions above, which triggers the effect again
        // props.profilesNotInCurrentChannel,
        // props.profilesInCurrentChannel,
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

    const InviteModalLink = (props: {inviteAsGuest?: boolean; children: React.ReactNode; id?: string}) => {
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
                    InvitationModalLink: (chunks: string) => (
                        <InviteModalLink id='customNoOptionsMessageLink'>
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
            backButtonClass={'btn-tertiary tertiary-button'}
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
                            title={(
                                <FormattedMessage
                                    id='channel_invite.policy_enforced.title'
                                    defaultMessage='Channel access is restricted by user attributes'
                                />
                            )}
                            message={(
                                <FormattedMessage
                                    id='channel_invite.policy_enforced.description'
                                    defaultMessage='Only people who match the specified access rules can be selected and added to this channel.'
                                />
                            )}
                        >
                            {structuredAttributes.length > 0 && (
                                <TagGroup>
                                    {structuredAttributes.flatMap((attribute) =>
                                        attribute.values.map((value) => (
                                            <AlertTag
                                                key={`${attribute.name}-${value}`}
                                                tooltipTitle={formatAttributeName(attribute.name)}
                                                text={value}
                                            />
                                        )),
                                    )}
                                </TagGroup>
                            )}
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
                    {(props.emailInvitationsEnabled && props.canInviteGuests) && inviteGuestLink}
                </div>
            </div>
        </GenericModal>
    );
};

export default injectIntl(ChannelInviteModalComponent);
