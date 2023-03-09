import React from 'react';
import {ActionFunc} from 'mattermost-redux/types/actions';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import {getCurrentUserId, getUsers} from 'mattermost-redux/selectors/entities/common';

import Permissions from 'mattermost-redux/constants/permissions';

import {useSelector} from 'react-redux';

import {getTeammateNameDisplaySetting} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/preferences';

import {displayUsername} from 'mattermost-webapp/packages/mattermost-redux/src/utils/user_utils';

import Profile from 'src/components/profile/profile';

import {Playbook, PlaybookMember} from 'src/types/playbook';

import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';

import {useHasPlaybookPermission, useHasSystemPermission} from 'src/hooks';

import {PlaybookPermissionGeneral, PlaybookRole} from 'src/types/permissions';

import ProfileAutocomplete from './profile_autocomplete';

const ProfileAutocompleteContainer = styled.div`
	border-bottom: 1px solid rgba(var(--sys-center-channel-color-rgb), 0.08);
	padding-top: 24px;
	padding-bottom: 24px;
`;

const Container = styled.div`
    display: flex;
    flex-direction: column;
`;

const UserLineContainer = styled.div`
    display: flex;
    align-items: center;
    margin: 12px 0;
`;

const UserList = styled.div`
    margin: 12px 0;
`;

const BelowLineProfile = styled(Profile)`
    flex-grow: 1;
    overflow: hidden;
`;

const IconWrapper = styled.div`
    display: inline-flex;
    padding: 10px 5px 10px 8px;
`;

export interface SelectUsersBelowProps {
    playbook: Playbook;
    members: PlaybookMember[];
    onAddMember: (member: PlaybookMember) => void;
    onRemoveUser: (userid: string) => void;
    onMakeAdmin: (userid: string) => void;
    onMakeMember: (userid: string) => void;
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
}

function roleDisplayText(roles: string[]) {
    if (roles.includes(PlaybookRole.Admin)) {
        return <FormattedMessage defaultMessage='Playbook Admin'/>;
    }

    return <FormattedMessage defaultMessage='Playbook Member'/>;
}

const SelectUsersBelow = (props: SelectUsersBelowProps) => {
    const permissionToManageSystem = useHasSystemPermission(Permissions.MANAGE_SYSTEM);
    const permissionToEditMembers = useHasPlaybookPermission(PlaybookPermissionGeneral.ManageMembers, props.playbook);
    const permissionToEditRoles = useHasPlaybookPermission(PlaybookPermissionGeneral.ManageRoles, props.playbook);
    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting) || '';
    const users = useSelector(getUsers);
    const currentUserId = useSelector(getCurrentUserId);

    const handleAddUser = (userId: string) => {
        props.onAddMember({user_id: userId, roles: [PlaybookRole.Member]});
    };

    const sortedMembers = props.members.slice().sort((a: PlaybookMember, b:PlaybookMember) => {
        return displayUsername(users[a.user_id], teammateNameDisplaySetting).localeCompare(displayUsername(users[b.user_id], teammateNameDisplaySetting));
    });

    return (
        <Container data-testid='members-list'>
            {permissionToEditMembers &&
            <ProfileAutocompleteContainer data-testid={'add-people-input'}>
                <ProfileAutocomplete
                    onAddUser={handleAddUser}
                    userIds={props.members.map((val: PlaybookMember) => val.user_id)}
                    searchProfiles={props.searchProfiles}
                    getProfiles={props.getProfiles}
                />
            </ProfileAutocompleteContainer>
            }
            <UserList>
                {sortedMembers.map((member: PlaybookMember) => (
                    <UserLine
                        data-testid='user-line'
                        key={member.user_id}
                        currentUserId={currentUserId}
                        hasPermissionToManageSystem={permissionToManageSystem}
                        hasPermissionsToEditRoles={permissionToEditRoles}
                        member={member}
                        onRemoveUser={props.onRemoveUser}
                        onMakeAdmin={props.onMakeAdmin}
                        onMakeMember={props.onMakeMember}
                    />
                ))}
            </UserList>
        </Container>
    );
};

interface UserLineProps {
    hasPermissionToManageSystem: boolean
    hasPermissionsToEditRoles: boolean
    member: PlaybookMember
    currentUserId: string
    onRemoveUser: (userid: string) => void;
    onMakeAdmin: (userid: string) => void;
    onMakeMember: (userid: string) => void;
}

const MemberButton = styled.div`
    display: inline-flex;
    border-radius: 4px;
    fill: var(--link-color);
    color: var(--link-color);
    &:hover {
       background: rgba(var(--center-channel-color-rgb), 0.08);
       color: rgba(var(--center-channel-color-rgb), 0.72);
    }
`;

const UserLine = (props: UserLineProps) => {
    const memberIsPlaybookAdmin = props.member.roles.includes(PlaybookRole.Admin);

    let text = (
        <IconWrapper>
            {roleDisplayText(props.member.roles)}
        </IconWrapper>
    );

    if (props.hasPermissionToManageSystem || (props.hasPermissionsToEditRoles && props.member.user_id !== props.currentUserId)) {
        let permissionsChangeOption = (
            <DropdownMenuItem
                onClick={() => props.onMakeAdmin(props.member.user_id)}
            >
                <FormattedMessage defaultMessage='Make Playbook Admin'/>
            </DropdownMenuItem>
        );

        if (memberIsPlaybookAdmin) {
            permissionsChangeOption = (
                <DropdownMenuItem
                    onClick={() => props.onMakeMember(props.member.user_id)}
                >
                    <FormattedMessage defaultMessage='Make Playbook Member'/>
                </DropdownMenuItem>
            );
        }

        text = (
            <DotMenu
                placement='bottom-end'
                dotMenuButton={MemberButton}
                portal={false}
                icon={
                    <IconWrapper>
                        {roleDisplayText(props.member.roles)}
                        <i className={'icon-chevron-down'}/>
                    </IconWrapper>
                }
            >
                {permissionsChangeOption}
                <DropdownMenuItem
                    onClick={() => props.onRemoveUser(props.member.user_id)}
                >
                    <FormattedMessage defaultMessage='Remove'/>
                </DropdownMenuItem>
            </DotMenu>
        );
    }

    return (
        <UserLineContainer>
            <BelowLineProfile userId={props.member.user_id}/>
            {text}
        </UserLineContainer>
    );
};

export default SelectUsersBelow;
