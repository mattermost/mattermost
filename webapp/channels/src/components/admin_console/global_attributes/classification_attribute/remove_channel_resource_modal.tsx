// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    onConfirm: () => void;
    onCancel?: () => void;
    onExited: () => void;
};

const noop = () => {};

/**
 * Removing the Channels resource deletes the linked channel field, and the server
 * deletes that field's values with it — every channel's marking, in one statement.
 * Adding the resource back creates a new field, so the old values are unreachable:
 * there is no undo through the product.
 */
export const useChannelResourceRemove = () => {
    const dispatch = useDispatch();

    const promptRemove = () => {
        return new Promise<boolean>((resolve) => {
            dispatch(openModal({
                modalId: ModalIdentifiers.CHANNEL_RESOURCE_REMOVE,
                dialogType: RemoveChannelResourceModal,
                dialogProps: {
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false),
                },
            }));
        });
    };

    return {promptRemove} as const;
};

function RemoveChannelResourceModal({onConfirm, onCancel, onExited}: Props) {
    const {formatMessage} = useIntl();

    return (
        <GenericModal
            confirmButtonText={formatMessage(messages.confirm)}
            confirmButtonVariant='destructive'
            handleCancel={onCancel ?? noop}
            handleConfirm={onConfirm}
            modalHeaderText={formatMessage(messages.title)}
            onExited={onExited}
            compassDesign={true}
            dataTestId='removeChannelResourceModal'
        >
            <FormattedMessage {...messages.body}/>
        </GenericModal>
    );
}

const messages = defineMessages({
    title: {
        id: 'admin.global_attributes.classification.remove_channels.title',
        defaultMessage: 'Stop applying Classification to channels?',
    },
    body: {
        id: 'admin.global_attributes.classification.remove_channels.body',
        defaultMessage: 'This deletes the classification value on every channel that has one. It cannot be undone from Mattermost.',
    },
    confirm: {
        id: 'admin.global_attributes.classification.remove_channels.confirm',
        defaultMessage: 'Remove and delete values',
    },
});

export default RemoveChannelResourceModal;
