// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {openModal} from 'actions/views/modals';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';
import EditChannelPurposeModal from 'components/edit_channel_purpose_modal';
import * as Menu from 'components/menu';
import RenameChannelModal from 'components/rename_channel_modal';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    channel: Channel;
    isReadonly: boolean;
}

const EditChannelData = ({channel, isReadonly}: Props): JSX.Element => {
    const dispatch = useDispatch();
    return (
        <>
            {!isReadonly && (
                <>
                    <Menu.Item
                        id='channelEditHeader'
                        onClick={() => {
                            dispatch(
                                openModal({
                                    modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
                                    dialogType: EditChannelHeaderModal,
                                    dialogProps: {channel},
                                }),
                            );
                        }}
                        labels={
                            <FormattedMessage
                                id='channel_header.setHeader'
                                defaultMessage='Edit Channel Header'
                            />
                        }
                    />
                    <Menu.Item
                        id='channelEditPurpose'
                        onClick={() => {
                            dispatch(
                                openModal({
                                    modalId: ModalIdentifiers.EDIT_CHANNEL_PURPOSE,
                                    dialogType: EditChannelPurposeModal,
                                    dialogProps: {channel},
                                }),
                            );
                        }}
                        labels={
                            <FormattedMessage
                                id='channel_header.setPurpose'
                                defaultMessage='Edit Channel Purpose'
                            />
                        }
                    />
                </>
            )}
            <Menu.Item
                id='channelRename'
                onClick={() => {
                    dispatch(
                        openModal({
                            modalId: ModalIdentifiers.RENAME_CHANNEL,
                            dialogType: RenameChannelModal,
                            dialogProps: {channel},
                        }),
                    );
                }}
                labels={
                    <FormattedMessage
                        id='channel_header.rename'
                        defaultMessage='Rename Channel'
                    />
                }
            />
        </>
    );
};

export default React.memo(EditChannelData);
