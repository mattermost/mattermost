// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import './mark_all_as_read_modal.scss';

type Props = {
    show: boolean;
    onConfirm: (checked: boolean) => void;
    onCancel: () => void;
}

export default function MarkAllAsReadModal({
    show,
    onConfirm,
    onCancel,
}: Props) {
    const [checked, setChecked] = useState(false);

    const title = (
        <FormattedMessage
            id='mark_all_as_read_modal.title'
            defaultMessage='Mark all messages as read?'
        />
    );

    const handleCancel = () => {
        setChecked(false);
        onCancel();
    };

    const message = (
        <FormattedMessage
            id='mark_all_as_read_modal.message'
            defaultMessage='{shift} {escape} will mark all messages as read in channels, threads, and Direct Messages for this team. Are you sure?'
            values={{
                shift: <kbd>
                    <FormattedMessage
                        id='keyboard.shift'
                        defaultMessage='Shift'
                    />
                </kbd>,
                escape: <kbd>
                    <FormattedMessage
                        id='keyboard.escape'
                        defaultMessage='ESC'
                    />
                </kbd>,
            }}
        />
    );

    const checkboxText = (
        <FormattedMessage
            id='mark_all_as_read_modal.checkbox'
            defaultMessage="Don't ask me again"
        />
    );

    const checkbox = (
        <div className='checkbox text-center mb-0'>
            <label>
                <input
                    type='checkbox'
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChecked(e.target.checked)}
                    checked={checked}
                />
                {checkboxText}
            </label>
        </div>
    );

    const cancelButtonText = (
        <FormattedMessage
            id='mark_all_as_read_modal.cancel'
            defaultMessage='Cancel'
        />
    );

    const confirmButtonText = (
        <FormattedMessage
            id='mark_all_as_read_modal.confirm'
            defaultMessage='Mark all read'
        />
    );

    return (
        <GenericModal
            show={show}
            className='mark_all_as_read_modal a11y__modal'
            onHide={handleCancel}
            onExited={handleCancel}
            ariaLabelledby='markAllReadModalLabel'
        >
            <div className='mark_all_as_read_modal__body'>
                <h2 id='markAllReadModalLabel'>{title}</h2>
                <p>{message}</p>
                {checkbox}
            </div>
            <div className='mark_all_as_read_modal__footer'>
                <button
                    className='btn btn-tertiary'
                    onClick={handleCancel}
                >
                    {cancelButtonText}
                </button>
                <button
                    className='btn btn-danger'
                    onClick={() => onConfirm(checked)}
                >
                    {confirmButtonText}
                </button>
            </div>
        </GenericModal>
    );
}
