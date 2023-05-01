import React, {useCallback, useEffect, useState} from 'react';
import {useSelector} from 'react-redux';
import ReactSelect, {ControlProps, GroupType, OptionsType} from 'react-select';

import styled from 'styled-components';
import {ActionFunc} from 'mattermost-redux/types/actions';
import {UserProfile} from '@mattermost/types/users';
import {Group} from '@mattermost/types/groups';
import {GlobalState} from '@mattermost/types/store';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getGroup} from 'mattermost-redux/selectors/entities/groups';

import {AccountMultipleOutlineIcon} from '@mattermost/compass-icons/components';

import {FormattedMessage, useIntl} from 'react-intl';

import Profile from 'src/components/profile/profile';
import {useEnsureProfiles, useEnsureGroupsAndMemberIds} from 'src/hooks';

import MenuList from 'src/components/backstage/playbook_edit/automation/menu_list';

interface Props {
    userIds: string[];
    groupIds: string[];
    onAddUser: (userid: string) => void;
    onAddGroup: (groupid: string) => void;
    onRemoveUser: (userid: string, username: string) => void;
    onRemoveGroup: (groupid: string) => void;
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
    searchGroups: (term: string) => ActionFunc;
    getGroups: () => ActionFunc;
    isDisabled: boolean;
}

const InviteUsersSelector = (props: Props) => {
    const {formatMessage} = useIntl();
    const [searchTerm, setSearchTerm] = useState('');
    const invitedUsers = useSelector<GlobalState, UserProfile[]>((state: GlobalState) => props.userIds.map((id) => getUser(state, id)));
    const invitedUserGroups = useSelector<GlobalState, Group[]>((state: GlobalState) => props.groupIds.map((id) => getGroup(state, id)));

    const [searchedUsers, setSearchedUsers] = useState<UserProfile[]>([]);
    const [searchedGroups, setSearchedGroups] = useState<Group[]>([]);
    useEnsureProfiles(props.userIds);
    useEnsureGroupsAndMemberIds(props.groupIds || []); 

    const isUser = (option: UserProfile | Group): option is UserProfile => {
        return (option as UserProfile).username !== undefined;
    };

    // Update the options when the search term is updated
    useEffect(() => {
        const updateOptions = async (term: string) => {
            let profiles;
            let groups;
            if (term.trim().length === 0) {
                profiles = props.getProfiles();
                groups = props.getGroups();
            } else {
                profiles = props.searchProfiles(term);
                groups = props.searchGroups(term);
            }

            //@ts-ignore
            profiles.then(({data}: { data: UserProfile[] }) => {
                setSearchedUsers(data || []);
            });

            //@ts-ignore
            groups.then(({data}: { data: Group[] }) => {
                setSearchedGroups(data || []);
            });
        };

        updateOptions(searchTerm);
    }, [searchTerm]);

    let invitedProfiles: UserProfile[] = [];
    let nonInvitedProfiles: UserProfile[] = [];
    let invitedGroups: Group[] = [];
    let nonInvitedGroups: Group[] = [];

    if (searchTerm.trim().length === 0) {
        // Filter out all the undefined users, which will cast to false in the filter predicate
        invitedProfiles = invitedUsers.filter((user) => user);
        nonInvitedProfiles = searchedUsers.filter(
            (profile: UserProfile) => !props.userIds.includes(profile.id),
        );

        invitedGroups = invitedUserGroups.filter((group) => group);
        nonInvitedGroups = searchedGroups.filter(
            (group: Group) => !props.groupIds.includes(group.id),
        );
    } else {
        searchedUsers.forEach((profile: UserProfile) => {
            if (props.userIds.includes(profile.id)) {
                invitedProfiles.push(profile);
            } else {
                nonInvitedProfiles.push(profile);
            }
        });
        searchedGroups.forEach((group: Group) => {
            if (props.groupIds.includes(group.id)) {
                invitedGroups.push(group);
            } else {
                nonInvitedGroups.push(group);
            }
        });
    }

    const sortOptions = useCallback((profilesAndGroups: (UserProfile | Group)[]) => {
        return profilesAndGroups.sort((a: UserProfile | Group, b: UserProfile | Group) => {
            let aSortString = '';
            let bSortString = '';

            if (isUser(a)) {
                aSortString = a.username;
            } else {
                aSortString = a.name;
            }
            if (isUser(b)) {
                bSortString = b.username;
            } else {
                bSortString = b.name;
            }

            return aSortString.localeCompare(bSortString);
        });
    }, []);

    const sortedNonInvitedOptions = sortOptions([...nonInvitedProfiles, ...nonInvitedGroups]);

    let options: (UserProfile | Group)[] | GroupType<(UserProfile | Group)>[] = sortedNonInvitedOptions;
    if (invitedProfiles.length !== 0 || invitedGroups.length !== 0) {
        const sortedInvitedOptions = sortOptions([...invitedProfiles, ...invitedGroups]);
        options = [
            {label: 'SELECTED', options: sortedInvitedOptions},
            {label: 'ALL', options: sortedNonInvitedOptions},
        ];
    }

    let badgeContent = '';
    const numInvitedMembers = props.userIds.length + props.groupIds.length;
    if (numInvitedMembers > 0) {
        badgeContent = `${numInvitedMembers} SELECTED`;
    }

    // Type guard to check whether the current options is a group or a plain list
    const isGroupType = (option: UserProfile | Group | GroupType<UserProfile | Group>): option is GroupType<UserProfile> => (
        (option as GroupType<UserProfile>).label
    );

    return (
        <StyledReactSelect
            badgeContent={badgeContent}
            closeMenuOnSelect={false}
            onInputChange={setSearchTerm}
            options={options}
            filterOption={() => true}
            isDisabled={props.isDisabled}
            isMulti={false}
            controlShouldRenderValue={false}
            onChange={(optionAdded: UserProfile | Group) => (isUser(optionAdded) ? props.onAddUser(optionAdded.id) : props.onAddGroup(optionAdded.id))}
            getOptionValue={(optionAdded: UserProfile | Group) => optionAdded.id}
            formatOptionLabel={(option: UserProfile | Group) => {
                if (isUser(option)) {
                    return (
                        <UserLabel
                            onRemove={() => props.onRemoveUser(option.id, option.username)}
                            id={option.id}
                            invitedUsers={(options.length > 0 && isGroupType(options[0])) ? invitedProfiles : []}
                        />
                    );
                }
                return (
                    <GroupLabel
                        onRemove={() => props.onRemoveGroup(option.id)}
                        group={option}
                        invitedGroups={(options.length > 0 && isGroupType(options[0])) ? invitedGroups : []}
                    />
                );
            }}
            defaultMenuIsOpen={false}
            openMenuOnClick={true}
            isClearable={false}
            placeholder={formatMessage({defaultMessage: 'Search for people'})}
            components={{DropdownIndicator: () => null, IndicatorSeparator: () => null, MenuList}}
            styles={{
                control: (provided: ControlProps<UserProfile, boolean>) => ({
                    ...provided,
                    minHeight: 34,
                }),
            }}
            classNamePrefix='invite-users-selector'
            captureMenuScroll={false}
        />
    );
};

export default InviteUsersSelector;

interface UserLabelProps {
    onRemove: () => void;
    id: string;
    invitedUsers: OptionsType<UserProfile>;
}

const UserLabel = (props: UserLabelProps) => {
    let icon = <PlusIcon/>;
    if (props.invitedUsers.find((user: UserProfile) => user.id === props.id)) {
        icon = <Remove onClick={props.onRemove}><FormattedMessage defaultMessage='Remove'/></Remove>;
    }

    return (
        <>
            <StyledProfile userId={props.id}/>
            {icon}
        </>
    );
};

interface GroupLabelProps {
    onRemove: () => void;
    group: Group;
    invitedGroups: OptionsType<Group>;
}

const GroupLabel = (props: GroupLabelProps) => {
    let icon = <PlusIcon/>;
    if (props.invitedGroups.find((group: Group) => group.id === props.group.id)) {
        icon = <Remove onClick={props.onRemove}><FormattedMessage defaultMessage='Remove'/></Remove>;
    }
    const groupName = `@${props.group.name}`;
    return (
        <>
            <GroupOption>
                <GroupIcon>
                    <AccountMultipleOutlineIcon
                        size={12}
                        color={'rgba(var(--center-channel-color-rgb), 0.56)'}
                    />
                </GroupIcon>
                <span>
                    {props.group.display_name}
                </span>
                <GroupName className='ml-2 light'>
                    {groupName}
                </GroupName>
            </GroupOption>
            {icon}
        </>
    );
};

const GroupName = styled.span`
    font-weight: 400;
    font-size: 12px;
    line-height: 18px;
`;

const GroupIcon = styled.div`
    display: flex;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 50%;
    align-items: center;
    justify-content: center;
    width: 24px;
    min-width: 24px;
    height: 24px;
    margin-right: 8px;
`;

const GroupOption = styled.div`
    display: flex;
    align-items: center;
    flex-direction: row;
`;

const Remove = styled.span`
    display: inline-block;

    font-weight: 600;
    font-size: 12px;
    line-height: 9px;
    color: rgba(var(--center-channel-color-rgb), 0.56);

    :hover {
        cursor: pointer;
    }
`;

const StyledProfile = styled(Profile)`
    && .image {
        width: 24px;
        height: 24px;
    }
`;

const PlusIcon = styled.i`
    // Only shows on hover, controlled in the style from
    // .invite-users-selector__option--is-focused
    display: none;

    :before {
        font-family: compass-icons;
        font-size: 14.4px;
        line-height: 17px;
        color: var(--button-bg);
        content: "\f0415";
        font-style: normal;
    }
`;

const StyledReactSelect = styled(ReactSelect)`
    flex-grow: 1;
    background-color: ${(props) => (props.isDisabled ? 'rgba(var(--center-channel-bg-rgb), 0.16)' : 'var(--center-channel-bg)')};

    .invite-users-selector__input {
        color: var(--center-channel-color);
    }

    .invite-users-selector__menu {
        background-color: transparent;
        box-shadow: 0px 8px 24px rgba(0, 0, 0, 0.12);
    }


    .invite-users-selector__option {
        height: 36px;
        padding: 6px 21px 6px 12px;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
    }

    .invite-users-selector__option--is-selected {
        background-color: var(--center-channel-bg);
        color: var(--center-channel-color);
    }

    .invite-users-selector__option--is-focused {
        background-color: rgba(var(--button-bg-rgb), 0.04);

        ${PlusIcon} {
            display: inline-block;
        }
    }

    .invite-users-selector__control {
        -webkit-transition: all 0.15s ease;
        -webkit-transition-delay: 0s;
        -moz-transition: all 0.15s ease;
        -o-transition: all 0.15s ease;
        transition: all 0.15s ease;
        transition-delay: 0s;
        background-color: transparent;
        border-radius: 4px;
        border: none;
        box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
        width: 100%;
        height: 4rem;
        font-size: 14px;
        padding-left: 3.2rem;
        padding-right: 16px;

        &--is-focused {
            box-shadow: inset 0 0 0px 2px var(--button-bg);
        }

        &:before {
            left: 16px;
            top: 8px;
            position: absolute;
            color: rgba(var(--center-channel-color-rgb), 0.56);
            content: '\f0349';
            font-size: 18px;
            font-family: 'compass-icons', mattermosticons;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        &:after {
            padding: 0px 4px;

            /* Light / 8% Center Channel Text */
            background: rgba(var(--center-channel-color-rgb), 0.08);
            border-radius: 4px;


            content: '${(props) => !props.isDisabled && props.badgeContent}';

            font-weight: 600;
            font-size: 10px;
            line-height: 16px;
        }
    }

    .invite-users-selector__option {
        &:active {
            background-color: rgba(var(--center-channel-color-rgb), 0.08);
        }
    }

    .invite-users-selector__group-heading {
        height: 32px;
        padding: 8px 12px 8px;
        font-size: 12px;
        font-weight: 600;
        line-height: 16px;
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;
