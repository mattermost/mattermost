// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {openModal} from 'actions/views/modals';

import ConvertChannelModal from 'components/convert_channel_modal';
import * as Menu from 'components/menu';

import {Constants, ModalIdentifiers} from 'utils/constants';

type Props = {
    isArchived: boolean;
    isDefault: boolean;
    channel: Channel;
}

const ConvertPublictoPrivate = ({isArchived, isDefault, channel}: Props): JSX.Element => {
    const dispatch = useDispatch();
    if (isArchived || isDefault || channel.type !== Constants.OPEN_CHANNEL) {
        return <></>;
    }

    return (
        <Menu.Item
            id='channelConvertToPrivate'
            onClick={() => {
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
            }}
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
