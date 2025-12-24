// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useEffect} from 'react';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {closeModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import './text_input_modal.scss';

type Props = {
    show?: boolean;
    title: string;
    fieldLabel?: string;
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
    fieldLabel,
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

    // Reset value when modal opens or initialValue changes
    useEffect(() => {
        if (show) {
            setValue(initialValue);
        }
    }, [show, initialValue]);

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
            <div className='TextInputModal__body'>
                <label
                    htmlFor='text-input-modal-input'
                    className='TextInputModal__label'
                >
                    {fieldLabel || title}
                </label>
                <input
                    id='text-input-modal-input'
                    type='text'
                    className='form-control TextInputModal__input'
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus={true}
                    maxLength={maxLength}
                    data-testid={inputTestId || 'text-input-modal-input'}
                />
                {helpText && (
                    <small className='TextInputModal__help-text'>
                        {helpText}
                    </small>
                )}
            </div>
        </GenericModal>
    );
};

export default TextInputModal;
