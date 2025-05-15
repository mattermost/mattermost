// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useEffect, useCallback, useRef} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';

import {useFocusTrap} from '../hooks/useFocusTrap';
import './generic_modal.scss';

export type ModalLocation = 'top' | 'center' | 'bottom';

export type Props = {
    className?: string;
    onExited?: () => void;
    onEntered?: () => void;
    onHide?: () => void;
    modalHeaderText?: React.ReactNode;
    modalSubheaderText?: React.ReactNode;
    show?: boolean;
    handleCancel?: () => void;
    handleConfirm?: () => void;
    handleEnterKeyPress?: () => void;
    handleKeydown?: (event?: React.KeyboardEvent<HTMLDivElement>) => void;
    confirmButtonText?: React.ReactNode;
    confirmButtonClassName?: string;
    cancelButtonText?: React.ReactNode;
    cancelButtonClassName?: string;
    isConfirmDisabled?: boolean;
    isDeleteModal?: boolean;
    id?: string;
    autoCloseOnCancelButton?: boolean;
    autoCloseOnConfirmButton?: boolean;
    enforceFocus?: boolean;
    container?: React.ReactNode | React.ReactNodeArray;
    ariaLabel?: string;
    ariaLabelledby?: string;
    errorText?: string | React.ReactNode;
    compassDesign?: boolean;
    backdrop?: boolean | 'static';
    backdropClassName?: string;
    tabIndex?: number;
    children: React.ReactNode;
    autoFocusConfirmButton?: boolean;
    keyboardEscape?: boolean;
    headerInput?: React.ReactNode;
    bodyPadding?: boolean;
    bodyDivider?: boolean;
    bodyOverflowVisible?: boolean;
    footerContent?: React.ReactNode;
    footerDivider?: boolean;
    appendedContent?: React.ReactNode;
    headerButton?: React.ReactNode;
    showCloseButton?: boolean;
    showHeader?: boolean;

    /*
     * Controls the vertical location of the modal.
     * 'top' => margin-top: 5vh
     * 'center' => margin-top: calc(50vh - 240px)
     * 'bottom' => margin-top: calc(50vh + 240px) (example calculation)
     */
    modalLocation?: ModalLocation;

    /**
     * Optionally set a test ID for the container, so that the modal can be easily referenced
     * in tests (Cypress, Playwright, etc.)
     */
    dataTestId?: string;

    /**
     * Whether to delay activating the focus trap.
     *
     * This is useful for modals with dynamic content that might not be fully
     * rendered when the modal is opened. The delay allows the DOM to settle
     * before the focus trap identifies focusable elements. ie. MultiSelect
     *
     * When true, applies a 500ms delay.
     */
    delayFocusTrap?: boolean;
};

export const GenericModal: React.FC<Props> = ({
    show = true,
    id = 'genericModal',
    autoCloseOnCancelButton = true,
    autoCloseOnConfirmButton = true,
    enforceFocus = true,
    keyboardEscape = true,
    bodyPadding = true,
    showCloseButton = true,
    showHeader = true,
    modalLocation = 'center',
    className,
    onExited,
    onEntered,
    onHide,
    modalHeaderText,
    modalSubheaderText,
    handleCancel,
    handleConfirm,
    handleEnterKeyPress,
    handleKeydown,
    confirmButtonText,
    confirmButtonClassName,
    cancelButtonText,
    cancelButtonClassName,
    isConfirmDisabled,
    isDeleteModal,
    container,
    ariaLabel,
    ariaLabelledby,
    errorText,
    compassDesign,
    backdrop,
    backdropClassName,
    tabIndex,
    children,
    autoFocusConfirmButton,
    headerInput,
    bodyDivider,
    bodyOverflowVisible,
    footerContent,
    footerDivider,
    appendedContent,
    headerButton,
    dataTestId,
    delayFocusTrap,
}) => {
    const intl = useIntl();

    // Create a ref for the modal container
    const containerRef = useRef<HTMLDivElement>(null);

    const [showState, setShowState] = useState(show);

    // Use focus trap to keep focus within the modal when it's open
    useFocusTrap(showState, containerRef, {
        delayMs: delayFocusTrap ? 500 : undefined,
    });

    useEffect(() => {
        setShowState(show);
    }, [show]);

    const onHideCallback = useCallback(() => {
        setShowState(false);
        onHide?.();
    }, [onHide]);

    const handleCancelCallback = useCallback((event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (autoCloseOnCancelButton) {
            onHideCallback();
        }
        handleCancel?.();
    }, [autoCloseOnCancelButton, onHideCallback, handleCancel]);

    const handleConfirmCallback = useCallback((event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (autoCloseOnConfirmButton) {
            onHideCallback();
        }
        handleConfirm?.();
    }, [autoCloseOnConfirmButton, onHideCallback, handleConfirm]);

    const onEnterKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter') {
            if (event.nativeEvent.isComposing) {
                return;
            }
            if (handleConfirm && autoCloseOnConfirmButton) {
                onHideCallback();
            }
            handleEnterKeyPress?.();
        }
        handleKeydown?.(event);
    }, [handleConfirm, autoCloseOnConfirmButton, onHideCallback, handleEnterKeyPress, handleKeydown]);

    // Build confirm button if provided.
    let confirmButtonElement;
    if (handleConfirm) {
        const buttonTypeClass = isDeleteModal ? 'delete' : 'confirm';
        let confirmButtonTextContent: React.ReactNode = (
            <FormattedMessage
                id='generic_modal.confirm'
                defaultMessage='Confirm'
            />
        );
        if (confirmButtonText) {
            confirmButtonTextContent = confirmButtonText;
        }
        confirmButtonElement = (
            <button
                autoFocus={autoFocusConfirmButton}
                type='submit'
                className={classNames('GenericModal__button btn btn-primary', buttonTypeClass, confirmButtonClassName, {
                    disabled: isConfirmDisabled,
                })}
                onClick={handleConfirmCallback}
                disabled={isConfirmDisabled}
            >
                {confirmButtonTextContent}
            </button>
        );
    }

    // Build cancel button if provided.
    let cancelButtonElement;
    if (handleCancel) {
        let cancelButtonTextContent: React.ReactNode = (
            <FormattedMessage
                id='generic_modal.cancel'
                defaultMessage='Cancel'
            />
        );
        if (cancelButtonText) {
            cancelButtonTextContent = cancelButtonText;
        }
        cancelButtonElement = (
            <button
                type='button'
                className={classNames('GenericModal__button btn btn-tertiary', cancelButtonClassName)}
                onClick={handleCancelCallback}
            >
                {cancelButtonTextContent}
            </button>
        );
    }

    // Build header text if provided.
    const headerText = modalHeaderText && (
        <div className='GenericModal__header'>
            <h1 id='genericModalLabel' className='modal-title'>
                {modalHeaderText}
            </h1>
            {headerButton}
        </div>
    );

    // Map modalLocation to a CSS class.
    const locationClassMapping: Record<ModalLocation, string> = {
        top: 'GenericModal__location--top',
        center: 'GenericModal__location--center',
        bottom: 'GenericModal__location--bottom',
    };
    const modalLocationClass = locationClassMapping[modalLocation];

    // Accessibility labeling strategy:
    // 1. We always set aria-labelledby to ensure the modal has a proper label
    //    - First try to use the provided ariaLabeledBy prop
    //    - Fall back to 'genericModalLabel' which references the modal title
    // 2. We also support aria-label as a secondary option
    //    - This will only be used by screen readers if the element referenced by aria-labelledby doesn't exist
    //    - This provides a fallback for accessibility in case the referenced element is missing
    // Note: When both aria-labelledby and aria-label are present, aria-labelledby takes precedence
    const ariaLabelledbyValue = ariaLabelledby || 'genericModalLabel';

    return (
        <Modal
            id={id}
            role='none'
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledbyValue}
            aria-modal='true'
            dialogClassName={classNames(
                modalLocationClass,
                'a11y__modal GenericModal',
                {
                    GenericModal__compassDesign: compassDesign,
                    'modal--overflow': bodyOverflowVisible,
                },
                className,
            )}
            show={showState}
            restoreFocus={true}
            enforceFocus={enforceFocus}
            onHide={onHideCallback}
            onExited={onExited}
            backdrop={backdrop}
            backdropClassName={backdropClassName}
            container={container}
            keyboard={keyboardEscape}
            onEntered={onEntered}
            data-testid={dataTestId}
        >
            <div
                ref={containerRef}
                onKeyDown={onEnterKeyDown}
                tabIndex={tabIndex || 0}
                className='GenericModal__wrapper GenericModal__wrapper-enter-key-press-catcher'
            >
                {showHeader && (
                    <Modal.Header closeButton={false}>
                        <div className='GenericModal__header__text_container'>
                            {compassDesign && (
                                <>
                                    {headerText}
                                    {headerInput}
                                </>
                            )}
                            {modalSubheaderText && (
                                <div className='modal-subheading-container'>
                                    <div id='genericModalSubheading' className='modal-subheading'>
                                        {modalSubheaderText}
                                    </div>
                                </div>
                            )}
                        </div>
                        {showCloseButton && (
                            <button
                                type='button'
                                className='close'
                                onClick={onHideCallback}
                                aria-label={intl.formatMessage({id: 'generic_modal.close', defaultMessage: 'Close'})}
                            >
                                <span aria-hidden='true'>{'×'}</span>
                                <span className='sr-only'>
                                    <FormattedMessage id='generic_modal.close' defaultMessage='Close' />
                                </span>
                            </button>
                        )}
                    </Modal.Header>
                )}
                <Modal.Body className={classNames({divider: bodyDivider, 'overflow-visible': bodyOverflowVisible})}>
                    {compassDesign ? (
                        errorText && (
                            <div className='genericModalError'>
                                <i className='icon icon-alert-outline'/>
                                <span>{errorText}</span>
                            </div>
                        )
                    ) : (
                        headerText
                    )}
                    <div className={classNames('GenericModal__body', {padding: bodyPadding})}>
                        {children}
                    </div>
                </Modal.Body>
                {(cancelButtonElement || confirmButtonElement || footerContent) && (
                    <Modal.Footer className={classNames({divider: footerDivider})}>
                        {(cancelButtonElement || confirmButtonElement) ? (
                            <>
                                {cancelButtonElement}
                                {confirmButtonElement}
                            </>
                        ) : (
                            footerContent
                        )}
                    </Modal.Footer>
                )}
                {Boolean(appendedContent) && appendedContent}
            </div>
        </Modal>
    );
};

export default GenericModal;
