// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    name: string;
    onConfirm: () => void;
    onExited: () => void;
};

// GenericModal only renders a Cancel button when handleCancel is supplied, and
// cancelling needs no side effect here beyond closing — same shape as
// user_properties_delete_modal.
const noop = () => {};

/**
 * Opens the delete-confirmation modal for a Global Attribute. The modal is
 * display-only: `onConfirm` fires the caller's own delete logic, which owns the
 * API call and its error handling. Mirrors useUserPropertyFieldDelete /
 * useBoardAttributeFieldDelete, but passes the callback in rather than resolving
 * a Promise, since the caller's handler is async and reports its own failures.
 */
export const useGlobalAttributeFieldDelete = () => {
    const dispatch = useDispatch();

    return (name: string, onConfirm: () => void) => {
        dispatch(openModal({
            modalId: ModalIdentifiers.GLOBAL_ATTRIBUTE_FIELD_DELETE,
            dialogType: GlobalAttributeDeleteModal,
            dialogProps: {name, onConfirm},
        }));
    };
};

function GlobalAttributeDeleteModal({name, onConfirm, onExited}: Props) {
    const {formatMessage} = useIntl();

    const title = formatMessage({
        id: 'admin.global_attributes.confirm.delete.title',
        defaultMessage: 'Delete {name} attribute',
    }, {name});

    const confirmButtonText = formatMessage({
        id: 'admin.system_properties.confirm.delete.button',
        defaultMessage: 'Delete',
    });

    return (
        <GenericModal
            confirmButtonText={confirmButtonText}
            confirmButtonVariant='destructive'
            handleCancel={noop}
            handleConfirm={onConfirm}
            modalHeaderText={title}
            onExited={onExited}
            compassDesign={true}
        >
            <FormattedMessage
                id='admin.global_attributes.confirm.delete.body'
                defaultMessage='Deleting this attribute will permanently remove its definition. This action cannot be undone.'
            />
        </GenericModal>
    );
}

export default GlobalAttributeDeleteModal;
