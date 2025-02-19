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

type Props = {
    channel: Channel;
}

const Groups = ({channel}: Props): JSX.Element => {
    const dispatch = useDispatch();
    return (
        <>
            <Menu.Item
                id='channelAddGroups'
                leadingElement={<AccountMultiplePlusOutlineIcon size='18px'/>}
                onClick={() => {
                    dispatch(
                        openModal({
                            modalId: ModalIdentifiers.ADD_GROUPS_TO_CHANNEL,
                            dialogType: AddGroupsToChannelModal,
                        }),
                    );
                }}
                labels={
                    <FormattedMessage
                        id='navbar.addGroups'
                        defaultMessage='Add Groups'
                    />
                }
            />
            <Menu.Item
                id='channelManageGroups'
                leadingElement={<AccountMultipleOutlineIcon size='18px'/>}
                onClick={() => {
                    dispatch(
                        openModal({
                            modalId: ModalIdentifiers.MANAGE_CHANNEL_GROUPS,
                            dialogType: ChannelGroupsManageModal,
                            dialogProps: {channelID: channel.id},
                        }),
                    );
                }}
                labels={
                    <FormattedMessage
                        id='navbar_dropdown.manageGroups'
                        defaultMessage='Manage Groups'
                    />
                }
            />
        </>
    );
};

export default React.memo(Groups);
