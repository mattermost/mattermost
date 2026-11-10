// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import UnarchiveChannelModal from 'components/unarchive_channel_modal';

import type {KindMessages} from 'utils/channel_kind';
import {ModalIdentifiers} from 'utils/constants';

import type {ChannelKind} from 'types/store/plugins';

type Props = {
    channel: Channel;

    /** Names it Unarchive Board for a board. */
    kind?: ChannelKind;
};

const UnarchiveChannel = ({
    channel,
    kind = 'channel',
}: Props) => {
    const dispatch = useDispatch();

    const handleUnarchiveChannel = () => {
        dispatch(
            openModal({
                modalId: ModalIdentifiers.UNARCHIVE_CHANNEL,
                dialogType: UnarchiveChannelModal,
                dialogProps: {channel},
            }),
        );
    };

    return (
        <>
            <Menu.Separator/>
            <Menu.Item
                id='channelUnarchiveChannel'
                onClick={handleUnarchiveChannel}
                labels={<FormattedMessage {...messages.unarchive[kind]}/>}
            />
        </>
    );
};

const messages = {
    unarchive: {
        channel: defineMessage({
            id: 'channel_header.unarchive',
            defaultMessage: 'Unarchive Channel',
        }),
        board: defineMessage({
            id: 'channel_header.unarchive.board',
            defaultMessage: 'Unarchive Board',
        }),
    },
} satisfies Record<string, KindMessages>;

export default memo(UnarchiveChannel);
