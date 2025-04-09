// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {UserPropertyField} from '@mattermost/types/properties';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    name: string;
    onConfirm: () => void;
    onCancel?: () => void;
    onExited: () => void;
}

const noop = () => {};

export const useUserPropertyFieldDelete = () => {
    const dispatch = useDispatch();
    const promptDelete = (field: UserPropertyField) => {
        return new Promise<boolean>((resolve) => {
            dispatch(openModal({
                modalId: ModalIdentifiers.USER_PROPERTY_FIELD_DELETE,
                dialogType: RemoveUserPropertyFieldModal,
                dialogProps: {
                    name: field.name,
                    onConfirm: () => resolve(true),
                },
            }));
        });
    };

    return {promptDelete} as const;
};

function RemoveUserPropertyFieldModal({
    name,
    onExited,
    onCancel,
    onConfirm,
}: Props) {
    const {formatMessage} = useIntl();

    const title = formatMessage({
        id: 'admin.system_properties.confirm.delete.title',
        defaultMessage: 'Delete {name} property',
    }, {name});

    const confirmButtonText = formatMessage({
        id: 'admin.system_properties.confirm.delete.button',
        defaultMessage: 'Delete',
    });

    const message = (
        <FormattedMessage
            id={'admin.system_properties.confirm.delete.text'}
            defaultMessage={'Deleting this property will remove all user-defined values associated with it.'}
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

export default RemoveUserPropertyFieldModal;
