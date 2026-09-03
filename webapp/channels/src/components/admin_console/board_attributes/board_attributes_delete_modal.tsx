// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    onConfirm: () => void;
    onCancel: () => void;
    onExited: () => void;
};

export const useBoardAttributeFieldDelete = () => {
    const dispatch = useDispatch();
    const promptDelete = () => {
        return new Promise<boolean>((resolve) => {
            let settled = false;
            const settle = (value: boolean) => {
                if (!settled) {
                    settled = true;
                    resolve(value);
                }
            };
            dispatch(openModal({
                modalId: ModalIdentifiers.BOARD_ATTRIBUTE_FIELD_DELETE,
                dialogType: RemoveBoardAttributeFieldModal,
                dialogProps: {
                    onConfirm: () => settle(true),
                    onCancel: () => settle(false),
                    onExited: () => settle(false),
                },
            }));
        });
    };

    return {promptDelete} as const;
};

function RemoveBoardAttributeFieldModal({
    onExited,
    onCancel,
    onConfirm,
}: Props) {
    const {formatMessage} = useIntl();

    const title = formatMessage({
        id: 'admin.board_attributes.delete_modal.title',
        defaultMessage: 'Delete board attribute',
    });

    const confirmButtonText = formatMessage({
        id: 'admin.system_properties.confirm.delete.button',
        defaultMessage: 'Delete',
    });

    const message = (
        <FormattedMessage
            id='admin.board_attributes.delete_modal.confirm'
            defaultMessage='Are you sure you want to delete this board attribute? This cannot be undone.'
        />
    );

    return (
        <GenericModal
            confirmButtonText={confirmButtonText}
            confirmButtonVariant='destructive'
            handleCancel={onCancel}
            handleConfirm={onConfirm}
            modalHeaderText={title}
            onExited={onExited}
            compassDesign={true}
        >
            {message}
        </GenericModal>
    );
}

export default RemoveBoardAttributeFieldModal;
