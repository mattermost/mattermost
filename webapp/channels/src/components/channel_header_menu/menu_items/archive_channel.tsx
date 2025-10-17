// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {ArchiveOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {openModal} from 'actions/views/modals';

import DeleteChannelModal from 'components/delete_channel_modal';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    channel: Channel;
}

const ArchiveChannel = ({
    channel,
}: Props) => {
    const dispatch = useDispatch();

    const handleArchiveChannel = () => {
        dispatch(
            openModal({
                modalId: ModalIdentifiers.DELETE_CHANNEL,
                dialogType: DeleteChannelModal,
                dialogProps: {
                    channel,
                },
            }),
        );
    };

    return (
        <Menu.Item
            id='channelArchiveChannel'
            leadingElement={<ArchiveOutlineIcon size={18}/>}
            onClick={handleArchiveChannel}
            labels={
                <FormattedMessage
                    id='channel_header.delete'
                    defaultMessage='Archive Channel'
                />
            }
            isDestructive={true}
        />
    );
};

export default memo(ArchiveChannel);
