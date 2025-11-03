// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {closeModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    wikiTitle: string;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
    onExited: () => void;
}

const noop = () => {};

function WikiDeleteModal({
    wikiTitle,
    onExited,
    onCancel,
    onConfirm,
}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleConfirm = useCallback(async () => {
        setIsDeleting(true);
        try {
            await onConfirm();
            dispatch(closeModal(ModalIdentifiers.WIKI_DELETE));
        } catch (error) {
            setIsDeleting(false);
        }
    }, [onConfirm, dispatch]);

    const title = formatMessage({
        id: 'wiki_tab.delete_modal_title',
        defaultMessage: 'Delete wiki',
    });

    const confirmButtonText = formatMessage({
        id: 'wiki_tab.delete_modal_confirm',
        defaultMessage: 'Yes, delete',
    });

    const message = (
        <FormattedMessage
            id={'wiki_tab.delete_modal_text'}
            defaultMessage={'Are you sure you want to delete the wiki <strong>{wikiTitle}</strong>?'}
            values={{
                strong: (chunk) => <strong>{chunk}</strong>,
                wikiTitle,
            }}
        />
    );

    return (
        <GenericModal
            confirmButtonText={confirmButtonText}
            handleCancel={onCancel ?? noop}
            handleConfirm={handleConfirm}
            modalHeaderText={title}
            onExited={onExited}
            compassDesign={true}
            isDeleteModal={true}
            isConfirmDisabled={isDeleting}
            autoCloseOnConfirmButton={false}
        >
            {message}
        </GenericModal>
    );
}

export default WikiDeleteModal;
