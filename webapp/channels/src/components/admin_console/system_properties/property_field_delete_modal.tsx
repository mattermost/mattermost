// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {PropertyField} from '@mattermost/types/properties';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    name: string;
    onConfirm: () => void;
    onCancel?: () => void;
    onExited: () => void;
    messageId?: string;
    messageDefault?: string;
}

const noop = () => {};

// Shared hook for property field deletion confirmation
export const usePropertyFieldDelete = (messageId?: string, messageDefault?: string) => {
    const dispatch = useDispatch();
    const promptDelete = (field: PropertyField) => {
        return new Promise<boolean>((resolve) => {
            dispatch(openModal({
                modalId: ModalIdentifiers.PROPERTY_FIELD_DELETE,
                dialogType: RemovePropertyFieldModal,
                dialogProps: {
                    name: field.name,
                    messageId,
                    messageDefault,
                    onConfirm: () => resolve(true),
                },
            }));
        });
    };

    return {promptDelete} as const;
};

function RemovePropertyFieldModal({
    name,
    onExited,
    onCancel,
    onConfirm,
    messageId = 'admin.system_properties.confirm.delete.text',
    messageDefault = 'Deleting this attribute will remove all user-defined values associated with it.',
}: Props) {
    const {formatMessage} = useIntl();

    const title = formatMessage({
        id: 'admin.system_properties.confirm.delete.title',
        defaultMessage: 'Delete {name} attribute',
    }, {name});

    const confirmButtonText = formatMessage({
        id: 'admin.system_properties.confirm.delete.button',
        defaultMessage: 'Delete',
    });

    const message = (
        <FormattedMessage
            id={messageId}
            defaultMessage={messageDefault}
        />
    );

    return (
        <GenericModal
            confirmButtonText={confirmButtonText}
            handleCancel={onCancel ?? noop}
            handleConfirm={onConfirm}
            modalHeaderText={title}
            onExited={onExited}
            compassDesign={true}
            isDeleteModal={true}
        >
            {message}
        </GenericModal>
    );
}

export default RemovePropertyFieldModal;
