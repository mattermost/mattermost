// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {closeModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    show?: boolean;
    title: string;
    placeholder: string;
    helpText?: string;
    confirmButtonText?: string;
    cancelButtonText?: string;
    maxLength?: number;
    initialValue?: string;
    ariaLabel?: string;
    inputTestId?: string;
    modalId?: string;
    onConfirm: (value: string) => void | Promise<void>;
    onCancel: () => void;
    onHide?: () => void;
    onExited?: () => void;
};

const TextInputModal = ({
    show = true,
    title,
    placeholder,
    helpText,
    confirmButtonText = 'Confirm',
    cancelButtonText = 'Cancel',
    maxLength = 255,
    initialValue = '',
    ariaLabel,
    inputTestId,
    modalId = ModalIdentifiers.CREATE_WIKI,
    onConfirm,
    onCancel,
    onHide,
    onExited,
}: Props) => {
    const dispatch = useDispatch();
    const [value, setValue] = useState(initialValue);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = useCallback(async () => {
        const trimmedValue = value.trim();
        if (trimmedValue) {
            setIsSubmitting(true);
            try {
                await onConfirm(trimmedValue);
                setValue('');
                dispatch(closeModal(modalId));
                onHide?.();
            } catch (error) {
                setIsSubmitting(false);
            }
        }
    }, [value, onConfirm, dispatch, modalId, onHide]);

    const handleCancel = useCallback(() => {
        setValue('');
        setIsSubmitting(false);
        onCancel();
        onHide?.();
    }, [onCancel, onHide]);

    const handleExited = useCallback(() => {
        setIsSubmitting(false);
        onExited?.();
    }, [onExited]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirm();
        }
    }, [handleConfirm]);

    return (
        <GenericModal
            show={show}
            className='TextInputModal'
            ariaLabel={ariaLabel || title}
            modalHeaderText={title}
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={handleConfirm}
            handleCancel={handleCancel}
            onHide={onHide}
            onExited={handleExited}
            confirmButtonText={confirmButtonText}
            cancelButtonText={cancelButtonText}
            isConfirmDisabled={!value.trim() || isSubmitting}
            autoCloseOnConfirmButton={false}
        >
            <div style={{padding: '16px 0'}}>
                <label
                    htmlFor='text-input-modal-input'
                    style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: 600,
                    }}
                >
                    {title}
                </label>
                <input
                    id='text-input-modal-input'
                    type='text'
                    className='form-control'
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus={true}
                    maxLength={maxLength}
                    style={{width: '100%'}}
                    data-testid={inputTestId || 'text-input-modal-input'}
                />
                {helpText && (
                    <small
                        style={{
                            display: 'block',
                            marginTop: '8px',
                            color: 'var(--center-channel-color-64)',
                        }}
                    >
                        {helpText}
                    </small>
                )}
            </div>
        </GenericModal>
    );
};

export default TextInputModal;
