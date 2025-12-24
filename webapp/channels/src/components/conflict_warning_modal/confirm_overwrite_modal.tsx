// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Post} from '@mattermost/types/posts';

import {closeModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';
import {getPageTitle} from 'utils/post_utils';

export type ConfirmOverwriteModalProps = {
    currentPage: Post;
    onConfirm: () => void;
    onCancel: () => void;
    onExited?: () => void;
};

export default function ConfirmOverwriteModal({
    currentPage,
    onConfirm,
    onCancel,
    onExited,
}: ConfirmOverwriteModalProps) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const untitledText = formatMessage({id: 'wiki.untitled_page', defaultMessage: 'Untitled'});

    const handleClose = () => {
        dispatch(closeModal(ModalIdentifiers.PAGE_CONFIRM_OVERWRITE));
        onCancel();
    };

    const handleConfirm = () => {
        dispatch(closeModal(ModalIdentifiers.PAGE_CONFIRM_OVERWRITE));
        onConfirm();
    };

    const modalTitle = formatMessage({id: 'confirm_overwrite.title', defaultMessage: 'Confirm Overwrite'});

    return (
        <GenericModal
            className='confirm-overwrite-modal'
            dataTestId='confirm-overwrite-modal'
            ariaLabel={modalTitle}
            modalHeaderText={modalTitle}
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={handleConfirm}
            handleCancel={handleClose}
            onExited={onExited}
            confirmButtonText={formatMessage({id: 'confirm_overwrite.confirm', defaultMessage: 'Yes, Overwrite'})}
            cancelButtonText={formatMessage({id: 'confirm_overwrite.go_back', defaultMessage: 'Go Back'})}
            isDeleteModal={true}
            autoCloseOnConfirmButton={false}
            autoCloseOnCancelButton={false}
        >
            <div className='confirm-overwrite-content'>
                <p className='confirm-overwrite-warning'>
                    <i className='icon icon-alert-outline'/>
                    <FormattedMessage
                        id='confirm_overwrite.warning'
                        defaultMessage='You are about to permanently replace the changes made by another user.'
                    />
                </p>
                <p>
                    <FormattedMessage
                        id='confirm_overwrite.message'
                        defaultMessage="This action cannot be undone. The other user's changes will be lost, but will remain in the page history."
                    />
                </p>
                <div className='confirm-overwrite-info'>
                    <strong>
                        <FormattedMessage
                            id='confirm_overwrite.page_title'
                            defaultMessage='Page: {title}'
                            values={{title: getPageTitle(currentPage, untitledText)}}
                        />
                    </strong>
                    <br/>
                    <FormattedMessage
                        id='confirm_overwrite.last_modified'
                        defaultMessage='Last modified: {time}'
                        values={{
                            time: new Date(currentPage.update_at).toLocaleString(),
                        }}
                    />
                </div>
            </div>
        </GenericModal>
    );
}
