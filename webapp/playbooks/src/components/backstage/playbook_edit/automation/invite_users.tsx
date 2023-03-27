// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {ActionFunc} from 'mattermost-redux/types/actions';

import {FormattedMessage, useIntl} from 'react-intl';

import {AutomationHeader, AutomationTitle, SelectorWrapper} from 'src/components/backstage/playbook_edit/automation/styles';
import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import InviteUsersSelector from 'src/components/backstage/playbook_edit/automation/invite_users_selector';
import ConfirmModal from 'src/components/widgets/confirmation_modal';

interface Props {
    enabled: boolean;
    disabled?: boolean;
    onToggle: () => void;
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
    userIds: string[];
    preAssignedUserIds: string[];
    onAddUser: (userId: string) => void;
    onRemoveUser: (userId: string) => void;
    onRemovePreAssignedUser: (userId: string) => void;
    onRemovePreAssignedUsers: () => void;
}

interface UserInfo {
    userId: string;
    username: string;
}

export const InviteUsers = (props: Props) => {
    const {formatMessage} = useIntl();
    const [userToRemove, setUserToRemove] = useState<UserInfo | null>(null);
    const [showRemovePreAssigneeModal, setShowRemovePreAssigneeModal] = useState(false);

    const handleToggle = () => {
        if (props.preAssignedUserIds.length > 0 && props.enabled) {
            setShowRemovePreAssigneeModal(true);
            return;
        }
        props.onToggle();
    };

    const handleRemoveUser = (userId: string, username: string) => {
        if (props.preAssignedUserIds.includes(userId)) {
            setUserToRemove({userId, username});
            return;
        }
        props.onRemoveUser(userId);
    };

    return (
        <>
            <AutomationHeader>
                <AutomationTitle>
                    <Toggle
                        isChecked={props.enabled}
                        onChange={handleToggle}
                        disabled={props.disabled}
                    >
                        <FormattedMessage defaultMessage='Invite participants'/>
                    </Toggle>
                </AutomationTitle>
                <SelectorWrapper>
                    <InviteUsersSelector
                        isDisabled={props.disabled || !props.enabled}
                        onAddUser={props.onAddUser}
                        onRemoveUser={handleRemoveUser}
                        userIds={props.userIds}
                        searchProfiles={props.searchProfiles}
                        getProfiles={props.getProfiles}
                    />
                </SelectorWrapper>
            </AutomationHeader>
            <ConfirmModal
                show={showRemovePreAssigneeModal}
                title={formatMessage({defaultMessage: 'Confirm remove pre-assigned members'})}
                message={formatMessage(
                    {defaultMessage: 'There are users that are pre-assigned to one or more tasks. Disabling invitations will clear <strong>all</strong> pre-assignments.{br}{br}Are you sure you want to disable invitations?'},
                    {br: <br/>, strong: (x: React.ReactNode) => <strong>{x}</strong>}
                )}
                confirmButtonText={formatMessage({defaultMessage: 'Disable invitation'})}
                onConfirm={() => {
                    props.onRemovePreAssignedUsers();
                    setShowRemovePreAssigneeModal(false);
                }}
                onCancel={() => setShowRemovePreAssigneeModal(false)}
            />
            <ConfirmModal
                show={Boolean(userToRemove?.userId && userToRemove?.username)}
                title={formatMessage({defaultMessage: 'Confirm remove pre-assigned member'})}
                message={formatMessage(
                    {defaultMessage: 'The user <i>{name}</i> is pre-assigned to one or more tasks. Not automatically inviting this user will clear their pre-assignments.{br}{br}Are you sure you want to stop inviting this user as a member of the run?'},
                    {br: <br/>, i: (x: React.ReactNode) => <i>{x}</i>, name: userToRemove?.username}
                )}
                confirmButtonText={formatMessage({defaultMessage: 'Remove user'})}
                onConfirm={() => {
                    if (userToRemove) {
                        props.onRemovePreAssignedUser(userToRemove.userId);
                    }
                    setUserToRemove(null);
                }}
                onCancel={() => setUserToRemove(null)}
            />
        </>
    );
};
