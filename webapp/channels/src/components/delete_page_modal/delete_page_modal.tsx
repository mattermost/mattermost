// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import './delete_page_modal.scss';

type Props = {
    pageTitle: string;
    childCount: number;
    onConfirm: (deleteChildren: boolean) => void | Promise<void>;
    onCancel?: () => void;
    onExited: () => void;
};

const noop = () => {};

const DeletePageModal = ({
    pageTitle,
    childCount,
    onConfirm,
    onCancel,
    onExited,
}: Props) => {
    const {formatMessage} = useIntl();
    const [deleteChildren, setDeleteChildren] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleConfirm = useCallback(async () => {
        setIsDeleting(true);
        try {
            await onConfirm(deleteChildren);
        } catch {
            setIsDeleting(false);
        }
    }, [deleteChildren, onConfirm]);

    const modalTitle = formatMessage({id: 'delete_page_modal.title', defaultMessage: 'Delete Page'});
    const confirmText = formatMessage({id: 'delete_page_modal.confirm', defaultMessage: 'Delete'});

    return (
        <GenericModal
            className='DeletePageModal'
            ariaLabel={modalTitle}
            modalHeaderText={modalTitle}
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={handleConfirm}
            handleCancel={onCancel ?? noop}
            onExited={onExited}
            confirmButtonText={confirmText}
            isDeleteModal={true}
            isConfirmDisabled={isDeleting}
            confirmButtonTestId='delete-button'
            autoCloseOnConfirmButton={false}
        >
            <div className='DeletePageModal__body'>
                <p className='DeletePageModal__warning'>
                    {childCount > 0 ? (
                        formatMessage(
                            {id: 'delete_page_modal.warning_with_children', defaultMessage: 'You are about to delete "{pageTitle}". This page has {childCount, plural, one {1 child page} other {{childCount} child pages}}.'},
                            {pageTitle, childCount},
                        )
                    ) : (
                        formatMessage(
                            {id: 'delete_page_modal.warning', defaultMessage: 'Are you sure you want to delete "{pageTitle}"?'},
                            {pageTitle},
                        )
                    )}
                </p>

                {childCount > 0 && (
                    <div className='DeletePageModal__options'>
                        <label className='DeletePageModal__option'>
                            <input
                                id='delete-option-page-only'
                                type='radio'
                                name='deleteOption'
                                checked={!deleteChildren}
                                onChange={() => setDeleteChildren(false)}
                                aria-label={formatMessage({id: 'delete_page_modal.option_page_only.aria_label', defaultMessage: 'Delete this page only'})}
                            />
                            <div className='DeletePageModal__optionContent'>
                                <strong>{formatMessage({id: 'delete_page_modal.option_page_only.title', defaultMessage: 'Delete this page only'})}</strong>
                                <span className='DeletePageModal__optionDescription'>
                                    {formatMessage({id: 'delete_page_modal.option_page_only.description', defaultMessage: 'Child pages will move to the parent page'})}
                                </span>
                            </div>
                        </label>

                        <label className='DeletePageModal__option'>
                            <input
                                id='delete-option-page-and-children'
                                type='radio'
                                name='deleteOption'
                                checked={deleteChildren}
                                onChange={() => setDeleteChildren(true)}
                                aria-label={formatMessage({id: 'delete_page_modal.option_with_children.aria_label', defaultMessage: 'Delete this page and all child pages'})}
                            />
                            <div className='DeletePageModal__optionContent'>
                                <strong>{formatMessage({id: 'delete_page_modal.option_with_children.title', defaultMessage: 'Delete this page and all child pages'})}</strong>
                                <span className='DeletePageModal__optionDescription'>
                                    {formatMessage(
                                        {id: 'delete_page_modal.option_with_children.description', defaultMessage: 'All {childCount} child pages will be permanently deleted'},
                                        {childCount},
                                    )}
                                </span>
                            </div>
                        </label>
                    </div>
                )}

                <p className='DeletePageModal__note'>
                    <i className='icon icon-alert-outline'/>
                    {formatMessage({id: 'delete_page_modal.note', defaultMessage: 'This action cannot be undone.'})}
                </p>
            </div>
        </GenericModal>
    );
};

export default DeletePageModal;
