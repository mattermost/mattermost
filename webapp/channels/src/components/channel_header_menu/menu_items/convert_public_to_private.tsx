// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {openModal} from 'actions/views/modals';

import ConvertChannelModal from 'components/convert_channel_modal';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    channel: Channel;
}

const ConvertPublictoPrivate = ({channel}: Props): JSX.Element => {
    const dispatch = useDispatch();
    const handleConvertToPrivate = () => {
        dispatch(
            openModal({
                modalId: ModalIdentifiers.CONVERT_CHANNEL,
                dialogType: ConvertChannelModal,
                dialogProps: {
                    channelId: channel.id,
                    channelDisplayName: channel.display_name,
                },
            }),
        );
    };

    return (
        <Menu.Item
            id='channelConvertToPrivate'
            onClick={handleConvertToPrivate}
            labels={
                <FormattedMessage
                    id='channel_header.convert'
                    defaultMessage='Convert to Private Channel'
                />
            }
        />
    );
};

export default React.memo(ConvertPublictoPrivate);
