// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {openModal} from 'actions/views/modals';

import DeleteChannelModal from 'components/delete_channel_modal';
import * as Menu from 'components/menu';

import {useChannelKind} from 'hooks/useChannelKind';
import type {KindMessages} from 'utils/channel_kind';
import {getArchiveIconComponent} from 'utils/channel_utils';
import {ModalIdentifiers} from 'utils/constants';

type Props = {
    channel: Channel;
};

const ArchiveChannel = ({
    channel,
}: Props) => {
    const kind = useChannelKind(channel);
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

    const ArchiveIcon = getArchiveIconComponent(channel.type);

    return (
        <Menu.Item
            id='channelArchiveChannel'
            leadingElement={<ArchiveIcon size={18}/>}
            onClick={handleArchiveChannel}
            labels={<FormattedMessage {...messages.archive[kind]}/>}
            isDestructive={true}
        />
    );
};

const messages = {
    archive: {
        channel: defineMessage({
            id: 'channel_header.delete',
            defaultMessage: 'Archive Channel',
        }),
        board: defineMessage({
            id: 'channel_header.delete.board',
            defaultMessage: 'Archive Board',
        }),
    },
} satisfies Record<string, KindMessages>;

export default memo(ArchiveChannel);
