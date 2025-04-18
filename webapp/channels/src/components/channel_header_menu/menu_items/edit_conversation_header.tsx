// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {openModal} from 'actions/views/modals';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    channel: Channel;
    leadingElement?: React.ReactNode;
}

const EditConversationHeader = ({channel, leadingElement}: Props): JSX.Element => {
    const dispatch = useDispatch();
    const handleEditHeader = () => {
        dispatch(
            openModal({
                modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
                dialogType: EditChannelHeaderModal,
                dialogProps: {channel},
            }),
        );
    };

    return (
        <Menu.Item
            id='channelEditHeader'
            leadingElement={leadingElement}
            onClick={handleEditHeader}
            labels={
                <FormattedMessage
                    id='channel_header.setConversationHeader'
                    defaultMessage='Edit Header'
                />
            }
        />
    );
};

export default React.memo(EditConversationHeader);
