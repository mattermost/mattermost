// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {UserProfile} from '@mattermost/types/users';

import {isSystemAdmin, isGuest} from 'mattermost-redux/utils/user_utils';

import * as Menu from 'components/menu';

interface Props {
    tableId?: string;
    rowIndex: number;
    userRoles: UserProfile['roles'];
    currentUserRoles: UserProfile['roles'];
}

export function SystemUsersListAction(props: Props) {
    const {formatMessage} = useIntl();

    function getTranslatedUserRole(userRoles: UserProfile['roles']) {
        if (userRoles.length > 0 && isSystemAdmin(userRoles)) {
            return (
                <FormattedMessage
                    id='admin.system_users.list.actions.userAdmin'
                    defaultMessage='System Admin'
                />
            );
        } else if (isGuest(userRoles)) {
            return (
                <FormattedMessage
                    id='admin.system_users.list.actions.userGuest'
                    defaultMessage='Guest'
                />
            );
        }

        return (
            <FormattedMessage
                id='admin.system_users.list.actions.userMember'
                defaultMessage='Member'
            />
        );
    }

    const menuButtonId = `actionMenuButton-${props.tableId}-${props.rowIndex}`;
    const menuId = `actionMenu-${props.tableId}-${props.rowIndex}`;
    const menuItemIdPrefix = `actionMenuItem-${props.tableId}-${props.rowIndex}`;

    // Disable if SystemAdmin being edited by non SystemAdmin eg. userManager with EditOtherUsers permissions
    const isDisabled = !isSystemAdmin(props.currentUserRoles) && isSystemAdmin(props.userRoles);

    return (
        <Menu.Container
            menuButton={{
                id: menuButtonId,
                class: classNames('btn btn-quaternary btn-sm', {
                    disabled: isDisabled,
                }),
                disabled: isDisabled,
                children: (
                    <>
                        {getTranslatedUserRole(props.userRoles)}
                        {!isDisabled && (
                            <i
                                aria-hidden='true'
                                className='icon icon-chevron-down'
                            />
                        )}
                    </>
                ),
            }}
            menu={{
                id: menuId,
                'aria-label': formatMessage({
                    id: 'admin.system_users.list.actions.menu.dropdownAriaLabel',
                    defaultMessage: 'User actions menu',
                }),
            }}
        >
            <Menu.Item
                id={`${menuItemIdPrefix}-active`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.activate'
                        defaultMessage='Activate'
                    />
                }
            />
            <Menu.Item
                id={`${menuItemIdPrefix}-manageRoles`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.manageRoles'
                        defaultMessage='Mange roles'
                    />
                }
            />
            <Menu.Item
                id={`${menuItemIdPrefix}-manageTeams`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.manageTeams'
                        defaultMessage='Manage teams'
                    />
                }
            />
            <Menu.Item
                id={`${menuItemIdPrefix}-removeMFA`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.removeMFA'
                        defaultMessage='Remove MFA'
                    />
                }
            />
            <Menu.Item
                id={`${menuItemIdPrefix}-switchToEmailPassword`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.switchToEmailPassword'
                        defaultMessage='Switch to Email/Password'
                    />
                }
            />
            <Menu.Item
                id={`${menuItemIdPrefix}-updateEmail`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.updateEmail'
                        defaultMessage='Update email'
                    />
                }
            />
            <Menu.Item
                id={`${menuItemIdPrefix}-promoteToMember`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.promoteToMember'
                        defaultMessage='Promote to member'
                    />
                }
            />
            <Menu.Item
                id={`${menuItemIdPrefix}-demoteToGuest`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.demoteToGuest'
                        defaultMessage='Demote to guest'
                    />
                }
            />
            <Menu.Item
                id={`${menuItemIdPrefix}-removeSessions`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.removeSessions'
                        defaultMessage='Remove sessions'
                    />
                }
            />
            <Menu.Item
                id={`${menuItemIdPrefix}-resyncUserViaLdapGroups`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.resyncUserViaLdapGroups'
                        defaultMessage='Re-sync user via LDAP groups'
                    />
                }
            />
            <Menu.Item
                id={`${menuItemIdPrefix}-deactivate`}
                isDestructive={true}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.deactivate'
                        defaultMessage='Deactivate'
                    />
                }
            />
        </Menu.Container>
    );
}
