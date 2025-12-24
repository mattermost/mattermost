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

import './conflict_warning_modal.scss';

export type ConflictWarningModalProps = {
    currentPage: Post;
    onViewChanges: () => void;
    onCopyContent: () => void;
    onOverwrite: () => void;
    onCancel: () => void;
    onExited?: () => void;
};

export default function ConflictWarningModal({
    currentPage,
    onViewChanges,
    onCopyContent,
    onOverwrite,
    onCancel,
    onExited,
}: ConflictWarningModalProps) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const untitledText = formatMessage({id: 'wiki.untitled_page', defaultMessage: 'Untitled'});

    const handleClose = () => {
        dispatch(closeModal(ModalIdentifiers.PAGE_CONFLICT_WARNING));
        onCancel();
    };

    const handleOverwrite = () => {
        dispatch(closeModal(ModalIdentifiers.PAGE_CONFLICT_WARNING));
        onOverwrite();
    };

    const modalTitle = formatMessage({id: 'conflict_warning.title', defaultMessage: 'Page Was Modified'});

    return (
        <GenericModal
            className='conflict-warning-modal'
            dataTestId='conflict-warning-modal'
            ariaLabel={modalTitle}
            modalHeaderText={modalTitle}
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={handleOverwrite}
            handleCancel={handleClose}
            onExited={onExited}
            confirmButtonText={formatMessage({id: 'conflict_warning.overwrite', defaultMessage: 'Overwrite Anyway'})}
            cancelButtonText={formatMessage({id: 'conflict_warning.cancel', defaultMessage: 'Cancel'})}
            isDeleteModal={true}
            autoCloseOnConfirmButton={false}
            autoCloseOnCancelButton={false}
        >
            <div className='conflict-warning-content'>
                <p className='conflict-warning-primary'>
                    <i className='icon icon-information-outline'/>
                    <FormattedMessage
                        id='conflict_warning.first_write_message'
                        defaultMessage='Someone else published this page first while you were editing. Your changes have been preserved as a draft.'
                    />
                </p>
                <div className='conflict-warning-info'>
                    <strong>
                        <FormattedMessage
                            id='conflict_warning.page_title'
                            defaultMessage='Page: {title}'
                            values={{title: getPageTitle(currentPage, untitledText)}}
                        />
                    </strong>
                    <br/>
                    <FormattedMessage
                        id='conflict_warning.last_modified'
                        defaultMessage='Last modified: {time}'
                        values={{
                            time: new Date(currentPage.update_at).toLocaleString(),
                        }}
                    />
                </div>
                <p className='conflict-warning-options'>
                    <FormattedMessage
                        id='conflict_warning.options_message'
                        defaultMessage='You can view their changes, continue editing your draft to merge manually, or overwrite their version with yours.'
                    />
                </p>
                <div className='conflict-warning-actions'>
                    <button
                        className='btn btn-tertiary'
                        onClick={onViewChanges}
                    >
                        <FormattedMessage
                            id='conflict_warning.view_changes'
                            defaultMessage='View Their Changes'
                        />
                    </button>
                    <button
                        className='btn btn-tertiary'
                        onClick={onCopyContent}
                    >
                        <FormattedMessage
                            id='conflict_warning.copy_content'
                            defaultMessage='Copy My Content'
                        />
                    </button>
                </div>
            </div>
        </GenericModal>
    );
}
