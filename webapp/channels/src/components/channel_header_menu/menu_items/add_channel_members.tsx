// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {AccountPlusOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {openModal} from 'actions/views/modals';

import ChannelInviteModal from 'components/channel_invite_modal';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    channel: Channel;
}

const AddChannelMembers = ({channel}: Props): JSX.Element => {
    const dispatch = useDispatch();

    const handleAddMembers = () => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_INVITE,
            dialogType: ChannelInviteModal,
            dialogProps: {channel},
        }));
    };

    return (
        <Menu.Item
            id='channelAddMembers'
            leadingElement={<AccountPlusOutlineIcon size='18px'/>}
            onClick={handleAddMembers}
            labels={
                <FormattedMessage
                    id='navbar.addMembers'
                    defaultMessage='Add Members'
                />
            }
        />
    );
};

export default React.memo(AddChannelMembers);
