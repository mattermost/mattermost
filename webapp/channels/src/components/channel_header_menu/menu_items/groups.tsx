// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {AccountMultipleOutlineIcon, AccountMultiplePlusOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {openModal} from 'actions/views/modals';

import AddGroupsToChannelModal from 'components/add_groups_to_channel_modal';
import ChannelGroupsManageModal from 'components/channel_groups_manage_modal';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

interface Props extends Menu.FirstMenuItemProps {
    channel: Channel;
}

const Groups = ({channel, ...rest}: Props): JSX.Element => {
    const dispatch = useDispatch();
    const handleAddGroups = () => {
        dispatch(
            openModal({
                modalId: ModalIdentifiers.ADD_GROUPS_TO_CHANNEL,
                dialogType: AddGroupsToChannelModal,
            }),
        );
    };

    const handleManageGroups = () => {
        dispatch(
            openModal({
                modalId: ModalIdentifiers.MANAGE_CHANNEL_GROUPS,
                dialogType: ChannelGroupsManageModal,
                dialogProps: {channelID: channel.id},
            }),
        );
    };

    return (
        <>
            <Menu.Item
                id='channelAddGroups'
                leadingElement={<AccountMultiplePlusOutlineIcon size='18px'/>}
                onClick={handleAddGroups}
                labels={
                    <FormattedMessage
                        id='navbar.addGroups'
                        defaultMessage='Add Groups'
                    />
                }
                {...rest}
            />
            <Menu.Item
                id='channelManageGroups'
                leadingElement={<AccountMultipleOutlineIcon size='18px'/>}
                onClick={handleManageGroups}
                labels={
                    <FormattedMessage
                        id='navbar_dropdown.manageGroups'
                        defaultMessage='Manage Groups'
                    />
                }
                {...rest}
            />
        </>
    );
};

export default React.memo(Groups);
