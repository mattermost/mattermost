// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import {focusElement} from 'utils/a11y_utils';

import './confirm_modal.scss';

type Props = {
    id?: string;

    /*
     * Set to show modal
     */
    show: boolean;

    /*
     * Title to use for the modal
     */
    title?: React.ReactNode;

    /*
     * Message to display in the body of the modal
     */
    message?: React.ReactNode;

    /*
     * The CSS class to apply to the confirm button
     */
    confirmButtonClass?: string;

    /*
     * The CSS class to apply to the modal
     */
    modalClass?: string;

    /*
     * Text/jsx element on the confirm button
     */
    confirmButtonText?: React.ReactNode;

    /*
     * Text/jsx element on the cancel button
     */
    cancelButtonText?: React.ReactNode;

    /*
     * Set to show checkbox
     */
    showCheckbox?: boolean;

    /*
     * Text/jsx element to display with the checkbox
     */
    checkboxText?: React.ReactNode;

    /*
     * CSS class to apply to the checkbox container
     */
    checkboxClass?: string;

    /*
     * If true, show the checkbox in the footer instead of the modal body
     */
    checkboxInFooter?: boolean;

    /*
     * Function called when the confirm button or ENTER is pressed. Passes `true` if the checkbox is checked
     */
    onConfirm?: (checked: boolean) => void;

    /*
     * Function called when the cancel button is pressed or the modal is hidden. Passes `true` if the checkbox is checked
     */
    onCancel?: (checked: boolean) => void;

    /*
     * Function called when the checkbox is changed. Passes `true` if the checkbox is checked
     */
    onCheckboxChange?: (checked: boolean) => void;

    /**
     * Function called when modal is dismissed
     */
    onExited?: () => void;

    /*
     * Set to hide the cancel button
     */
    hideCancel?: boolean;

    /*
     * Set to hide the confirm button
     */
    hideConfirm?: boolean;

    /*
     * Set to disable the confirm button
     */
    confirmDisabled?: boolean;

    /*
     * The element that triggered the modal
     */
    focusOriginElement?: string;

    /**
     * Whether this modal is stacked on top of another modal.
     * When true, the modal will not render its own backdrop and will
     * adjust the z-index of the parent modal's backdrop.
     */
    isStacked?: boolean;
};

const ConfirmModal = ({
    title = '',
    message = '',
    confirmButtonClass = 'btn btn-primary',
    confirmButtonText = '',
    modalClass = '',
    id,
    show,
    focusOriginElement,
    isStacked,
    showCheckbox,
    checkboxText,
    checkboxClass,
    checkboxInFooter,
    cancelButtonText,
    hideCancel,
    hideConfirm,
    confirmDisabled,
    onConfirm,
    onCancel,
    onCheckboxChange,
    onExited,
}: Props) => {
    const [checked, setChecked] = useState(false);

    const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setChecked(e.target.checked);
        onCheckboxChange?.(e.target.checked);
    }, [onCheckboxChange]);

    const handleConfirm = useCallback(() => {
        onConfirm?.(checked);
    }, [checked, onConfirm]);

    const handleCancel = useCallback(() => {
        onCancel?.(checked);
    }, [checked, onCancel]);

    const handleExited = useCallback(() => {
        onExited?.();

        if (focusOriginElement) {
            focusElement(focusOriginElement, true);
        }
    }, [focusOriginElement, onExited]);

    let checkbox;
    if (showCheckbox) {
        const checkboxContainerClass = checkboxClass || 'checkbox text-right mb-0';
        checkbox = (
            <div className={checkboxContainerClass}>
                <label>
                    <input
                        type='checkbox'
                        onChange={handleCheckboxChange}
                        checked={checked}
                    />
                    {checkboxText}
                </label>
            </div>
        );
    }

    let cancelText;
    if (cancelButtonText) {
        cancelText = cancelButtonText;
    } else {
        cancelText = (
            <FormattedMessage
                id='confirm_modal.cancel'
                defaultMessage='Cancel'
            />
        );
    }

    let cancelButton;
    if (!hideCancel) {
        cancelButton = (
            <button
                type='button'
                data-testid='cancel-button'
                className='btn btn-tertiary'
                onClick={handleCancel}
                id='cancelModalButton'
            >
                {cancelText}
            </button>
        );
    }

    return (
        <GenericModal
            id={id || 'confirmModal'}
            className={`ConfirmModal a11y__modal ${modalClass}`}
            show={show}
            onHide={handleCancel}
            onExited={handleExited}
            ariaLabelledby='confirmModalLabel'
            compassDesign={true}
            modalHeaderText={title}
            isStacked={isStacked}
        >
            <div
                data-testid={id}
            >
                <div
                    className='ConfirmModal__body'
                    id='confirmModalBody'
                >
                    {message}
                    {!checkboxInFooter && checkbox}
                </div>
                <div className='ConfirmModal__footer'>
                    {checkboxInFooter && checkbox}
                    {cancelButton}
                    {!hideConfirm && (
                        <button
                            type='button'
                            className={confirmButtonClass}
                            onClick={handleConfirm}
                            id='confirmModalButton'
                            autoFocus={true}
                            disabled={confirmDisabled}
                        >
                            {confirmButtonText}
                        </button>
                    )}
                </div>
            </div>
        </GenericModal>
    );
};

export default memo(ConfirmModal);
