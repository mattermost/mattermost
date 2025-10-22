// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';

import {GenericModal} from '@mattermost/components';

import './delete_page_modal.scss';

type Props = {
    pageTitle: string;
    childCount: number;
    onConfirm: (deleteChildren: boolean) => void;
    onCancel: () => void;
};

const DeletePageModal = ({
    pageTitle,
    childCount,
    onConfirm,
    onCancel,
}: Props) => {
    const [deleteChildren, setDeleteChildren] = useState(false);

    const handleConfirm = useCallback(() => {
        onConfirm(deleteChildren);
    }, [deleteChildren, onConfirm]);

    const childText = childCount === 1 ? '1 child page' : `${childCount} child pages`;

    return (
        <GenericModal
            className='DeletePageModal'
            ariaLabel='Delete Page'
            modalHeaderText='Delete Page'
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={handleConfirm}
            handleCancel={onCancel}
            onExited={onCancel}
            confirmButtonText='Delete'
            confirmButtonClassName='btn-danger'
            autoCloseOnConfirmButton={true}
        >
            <div className='DeletePageModal__body'>
                <p className='DeletePageModal__warning'>
                    {'You are about to delete '}
                    <strong>{'"'}{pageTitle}{'"'}</strong>
                    {'. This page has '}
                    <strong>{childText}</strong>
                    {'.'}
                </p>

                <div className='DeletePageModal__options'>
                    <label className='DeletePageModal__option'>
                        <input
                            id='delete-option-page-only'
                            type='radio'
                            name='deleteOption'
                            checked={!deleteChildren}
                            onChange={() => setDeleteChildren(false)}
                            aria-label='Delete this page only'
                        />
                        <div className='DeletePageModal__optionContent'>
                            <strong>{'Delete this page only'}</strong>
                            <span className='DeletePageModal__optionDescription'>
                                {'Child pages will move to the parent page'}
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
                            aria-label='Delete this page and all child pages'
                        />
                        <div className='DeletePageModal__optionContent'>
                            <strong>{'Delete this page and all child pages'}</strong>
                            <span className='DeletePageModal__optionDescription'>
                                {'All '}
                                {childCount}
                                {' child pages will be permanently deleted'}
                            </span>
                        </div>
                    </label>
                </div>

                <p className='DeletePageModal__note'>
                    <i className='icon icon-alert-outline'/>
                    {'This action cannot be undone.'}
                </p>
            </div>
        </GenericModal>
    );
};

export default DeletePageModal;
