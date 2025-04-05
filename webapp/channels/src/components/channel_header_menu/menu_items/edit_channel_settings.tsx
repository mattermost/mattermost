// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {Permissions} from 'mattermost-redux/constants';

import {openModal} from 'actions/views/modals';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';
import EditChannelPurposeModal from 'components/edit_channel_purpose_modal';
import * as Menu from 'components/menu';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import RenameChannelModal from 'components/rename_channel_modal';

import {Constants, ModalIdentifiers} from 'utils/constants';

import MenuItemConvertToPrivate from './convert_public_to_private';

type Props = {
    channel: Channel;
    isReadonly: boolean;
    isDefault: boolean;
}

const EditChannelSettings = ({channel, isReadonly, isDefault}: Props): JSX.Element => {
    const dispatch = useDispatch();
    const channelPropertiesPermission = channel.type === Constants.PRIVATE_CHANNEL ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;

    const handleRenameChannel = () => {
        dispatch(
            openModal({
                modalId: ModalIdentifiers.RENAME_CHANNEL,
                dialogType: RenameChannelModal,
                dialogProps: {channel},
            }),
        );
    };

    const handleEditHeader = () => {
        dispatch(
            openModal({
                modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
                dialogType: EditChannelHeaderModal,
                dialogProps: {channel},
            }),
        );
    };

    const handleEditPurpose = () => {
        dispatch(
            openModal({
                modalId: ModalIdentifiers.EDIT_CHANNEL_PURPOSE,
                dialogType: EditChannelPurposeModal,
                dialogProps: {channel},
            }),
        );
    };
    return (
        <>
            {!isReadonly && (
                <>
                    <Menu.Item
                        id='channelRename'
                        onClick={handleRenameChannel}
                        labels={
                            <FormattedMessage
                                id='channel_header.rename'
                                defaultMessage='Rename Channel'
                            />
                        }
                    />
                    <ChannelPermissionGate
                        channelId={channel.id}
                        teamId={channel.team_id}
                        permissions={[channelPropertiesPermission]}
                    >
                        <Menu.Item
                            id='channelEditHeader'
                            onClick={handleEditHeader}
                            labels={
                                <FormattedMessage
                                    id='channel_header.setHeader'
                                    defaultMessage='Edit Channel Header'
                                />
                            }
                        />
                        <Menu.Item
                            id='channelEditPurpose'
                            onClick={handleEditPurpose}
                            labels={
                                <FormattedMessage
                                    id='channel_header.setPurpose'
                                    defaultMessage='Edit Channel Purpose'
                                />
                            }
                        />
                    </ChannelPermissionGate>
                </>
            )}

            {!isDefault && channel.type === Constants.OPEN_CHANNEL && (
                <ChannelPermissionGate
                    channelId={channel.id}
                    teamId={channel.team_id}
                    permissions={[Permissions.CONVERT_PUBLIC_CHANNEL_TO_PRIVATE]}
                >
                    <MenuItemConvertToPrivate
                        channel={channel}
                    />
                </ChannelPermissionGate>
            )}
        </>
    );
};

export default React.memo(EditChannelSettings);
