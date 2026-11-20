// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';
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
     * Whether the confirm button uses destructive styling
     */
    destructive?: boolean;

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

    /** The modal's testid, on the whole dialog (title and close button included); its buttons render `<testId>.confirm--button` and `<testId>.cancel--button`. Without it, the body takes the modal's id. */
    testId?: string;
};

const ConfirmModal = ({
    title = '',
    message = '',
    destructive,
    confirmButtonText = '',
    modalClass = '',
    id,
    testId,
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
                        data-testid={testId ? `${testId}.dont_show_again--checkbox` : undefined}
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
            <Button
                type='button'
                data-testid={testId ? `${testId}.cancel--button` : undefined}
                emphasis='tertiary'
                onClick={handleCancel}
                id='cancelModalButton'
            >
                {cancelText}
            </Button>
        );
    }

    return (
        <GenericModal
            id={id || 'confirmModal'}
            className={`ConfirmModal a11y__modal ${modalClass}`}
            show={show}
            onHide={handleCancel}
            onExited={handleExited}
            compassDesign={true}
            modalHeaderText={title}
            isStacked={isStacked}
            testId={testId}
        >
            <div
                data-testid={testId ? undefined : id}
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
                        <Button
                            type='button'
                            emphasis='primary'
                            destructive={destructive}
                            onClick={handleConfirm}
                            id='confirmModalButton'
                            data-testid={testId ? `${testId}.confirm--button` : undefined}
                            autoFocus={true}
                            disabled={confirmDisabled}
                        >
                            {confirmButtonText}
                        </Button>
                    )}
                </div>
            </div>
        </GenericModal>
    );
};

export default memo(ConfirmModal);
