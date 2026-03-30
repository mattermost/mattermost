// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import type {ClientLicense} from '@mattermost/types/config';
import type {Role} from '@mattermost/types/roles';

import Permissions from 'mattermost-redux/constants/permissions';

import {isMinimumProfessionalLicense} from 'utils/license_utils';

import EditPostTimeLimitButton from '../edit_post_time_limit_button';
import EditPostTimeLimitModal from '../edit_post_time_limit_modal';
import PermissionGroup from '../permission_group';
import type {Permission, Permissions as PermissionsType} from '../permissions_tree/types';

type Props = {
    license: ClientLicense;
    onToggle: (role: string, permissions: string[]) => void;
    readOnly: boolean;
    scope: string;
    selectRow: (permission: string) => void;
    parentRole?: Role;
    selected?: string;
    role?: Partial<Role>;
}

const GuestPermissionsTree = ({license, onToggle, readOnly, scope, selectRow, parentRole, selected, role = {permissions: []}}: Props) => {
    const setPermissions = () => {
        const guestPostsPermissions: Permission[] = [
            {
                id: 'guest_edit_post',
                combined: true,
                permissions: [
                    Permissions.EDIT_POST,
                ],
            },
            {
                id: 'guest_delete_post',
                combined: true,
                permissions: [
                    Permissions.DELETE_POST,
                ],
            },
            {
                id: 'guest_reactions',
                combined: true,
                permissions: [
                    Permissions.ADD_REACTION,
                    Permissions.REMOVE_REACTION,
                ],
            },
            {
                id: 'guest_use_channel_mentions',
                combined: true,
                permissions: [
                    Permissions.USE_CHANNEL_MENTIONS,
                ],
            },
        ];
        if (isMinimumProfessionalLicense(license)) {
            guestPostsPermissions.push({
                id: 'guest_use_group_mentions',
                combined: true,
                permissions: [
                    Permissions.USE_GROUP_MENTIONS,
                ],
            });
        }
        guestPostsPermissions.push({
            id: 'guest_' + Permissions.CREATE_POST,
            combined: true,
            permissions: [
                Permissions.CREATE_POST,
            ],
        });

        const defaultPermissions: Array<string | Permission> = [
            {
                id: 'guest_posts',
                permissions: guestPostsPermissions,
            },
            {
                id: 'guest_file_attachments',
                permissions: [
                    Permissions.UPLOAD_FILE_ATTACHMENT,
                    Permissions.DOWNLOAD_FILE_ATTACHMENT,
                ],
            },
            {
                id: 'guest_private_channel',
                permissions: [
                    {
                        id: 'guest_create_private_channel',
                        combined: true,
                        permissions: [
                            Permissions.CREATE_PRIVATE_CHANNEL,
                        ],
                    },
                ],
            },
        ];
        return defaultPermissions.map((permission) => {
            if (typeof permission === 'string') {
                return {
                    id: `guest_${permission}`,
                    combined: true,
                    permissions: [permission],
                };
            }
            return permission;
        });
    };

    const [editTimeLimitModalIsVisible, setEditTimeLimitModalIsVisible] = React.useState(false);
    const permissions = useMemo<PermissionsType>(setPermissions, [license]);

    const openPostTimeLimitModal = useCallback(() => {
        setEditTimeLimitModalIsVisible(true);
    }, []);
    const closePostTimeLimitModal = useCallback(() => {
        setEditTimeLimitModalIsVisible(false);
    }, []);
    const toggleGroup = useCallback((ids: string[]) => {
        if (readOnly) {
            return;
        }
        onToggle(role.name!, ids);
    }, [onToggle, readOnly, role.name]);

    const ADDITIONAL_VALUES = useMemo(() => {
        return {
            guest_edit_post: {
                editTimeLimitButton: (
                    <EditPostTimeLimitButton
                        onClick={openPostTimeLimitModal}
                        isDisabled={readOnly}
                    />
                ),
            },
        };
    }, [openPostTimeLimitModal, readOnly]);

    return (
        <div className='permissions-tree guest'>
            <div className='permissions-tree--header'>
                <div className='permission-name'>
                    <FormattedMessage
                        id='admin.permissions.permissionsTree.permission'
                        defaultMessage='Permission'
                    />
                </div>
                <div className='permission-description'>
                    <FormattedMessage
                        id='admin.permissions.permissionsTree.description'
                        defaultMessage='Description'
                    />
                </div>
            </div>
            <div className='permissions-tree--body'>
                <PermissionGroup
                    key='all'
                    id='all'
                    uniqId={role.name}
                    selected={selected}
                    selectRow={selectRow}
                    readOnly={readOnly}
                    permissions={permissions}
                    additionalValues={ADDITIONAL_VALUES}
                    role={role}
                    parentRole={parentRole}
                    scope={scope}
                    combined={false}
                    onChange={toggleGroup}
                    root={true}
                />
            </div>
            <EditPostTimeLimitModal
                onClose={closePostTimeLimitModal}
                show={editTimeLimitModalIsVisible}
            />
        </div>
    );
};

export default GuestPermissionsTree;
