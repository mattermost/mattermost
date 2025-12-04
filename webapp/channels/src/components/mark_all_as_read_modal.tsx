// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import './mark_all_as_read_modal.scss';
import {ShortcutSequence, ShortcutKeyVariant} from './shortcut_sequence';
import {ShortcutKeys} from './with_tooltip';

export type Props = {
    onConfirm: (dontAskAgain: boolean) => void;
    onExited?: () => void;
    onHide?: () => void;
}

export default function MarkAllAsReadModal({
    onConfirm,
    onExited,
    onHide,
}: Props) {
    const [checked, setChecked] = useState(false);

    const title = (
        <FormattedMessage
            id='mark_all_as_read_modal.title'
            defaultMessage='Mark all messages as read?'
        />
    );

    const handleClose = () => {
        setChecked(false);
        onHide?.();
    };

    const handleConfirm = () => {
        onConfirm(checked);
        onHide?.();
    };

    const message = (
        <FormattedMessage
            id='mark_all_as_read_modal.message'
            defaultMessage='{shortcut} will mark all messages as read in channels, threads, and Direct Messages for this team. Are you sure?'
            values={{
                shortcut: (
                    <ShortcutSequence
                        keys={[ShortcutKeys.shift, ShortcutKeys.esc]}
                        variant={ShortcutKeyVariant.InlineContent}
                    />
                ),
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
            className='mark_all_as_read_modal a11y__modal'
            onHide={handleClose}
            onExited={onExited}
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
                    onClick={handleClose}
                >
                    {cancelButtonText}
                </button>
                <button
                    className='btn btn-danger'
                    onClick={handleConfirm}
                >
                    {confirmButtonText}
                </button>
            </div>
        </GenericModal>
    );
}
