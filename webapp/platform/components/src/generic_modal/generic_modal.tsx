// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useEffect, useCallback, useRef} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

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
    modalLocation?: ModalLocation;
    dataTestId?: string;
};

export const GenericModal: React.FC<Props> = (props) => {
    const {
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
    } = props;

    // Create a ref for the modal container
    const containerRef = useRef<HTMLDivElement>(null);

    const [showState, setShowState] = useState(show);

    // Use focus trap to keep focus within the modal when it's open
    useFocusTrap(showState, containerRef);

    useEffect(() => {
        setShowState(show);
    }, [show]);

    const onHide = useCallback(() => {
        setShowState(false);
        props.onHide?.();
    }, [props.onHide]);

    const handleCancel = useCallback((event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (autoCloseOnCancelButton) {
            onHide();
        }
        props.handleCancel?.();
    }, [autoCloseOnCancelButton, onHide, props.handleCancel]);

    const handleConfirm = useCallback((event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (autoCloseOnConfirmButton) {
            onHide();
        }
        props.handleConfirm?.();
    }, [autoCloseOnConfirmButton, onHide, props.handleConfirm]);

    const onEnterKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter') {
            if (event.nativeEvent.isComposing) {
                return;
            }
            if (props.handleConfirm && autoCloseOnConfirmButton) {
                onHide();
            }
            props.handleEnterKeyPress?.();
        }
        props.handleKeydown?.(event);
    }, [props.handleConfirm, autoCloseOnConfirmButton, onHide, props.handleEnterKeyPress, props.handleKeydown]);

    // Build confirm button if provided.
    let confirmButton;
    if (props.handleConfirm) {
        const buttonTypeClass = props.isDeleteModal ? 'delete' : 'confirm';
        let confirmButtonText: React.ReactNode = (
            <FormattedMessage
                id='generic_modal.confirm'
                defaultMessage='Confirm'
            />
        );
        if (props.confirmButtonText) {
            confirmButtonText = props.confirmButtonText;
        }
        confirmButton = (
            <button
                autoFocus={props.autoFocusConfirmButton}
                type='submit'
                className={classNames('GenericModal__button btn btn-primary', buttonTypeClass, props.confirmButtonClassName, {
                    disabled: props.isConfirmDisabled,
                })}
                onClick={handleConfirm}
                disabled={props.isConfirmDisabled}
            >
                {confirmButtonText}
            </button>
        );
    }

    // Build cancel button if provided.
    let cancelButton;
    if (props.handleCancel) {
        let cancelButtonText: React.ReactNode = (
            <FormattedMessage
                id='generic_modal.cancel'
                defaultMessage='Cancel'
            />
        );
        if (props.cancelButtonText) {
            cancelButtonText = props.cancelButtonText;
        }
        cancelButton = (
            <button
                type='button'
                className={classNames('GenericModal__button btn btn-tertiary', props.cancelButtonClassName)}
                onClick={handleCancel}
            >
                {cancelButtonText}
            </button>
        );
    }

    // Build header text if provided.
    const headerText = props.modalHeaderText && (
        <div className='GenericModal__header'>
            <h1 id='genericModalLabel' className='modal-title'>
                {props.modalHeaderText}
            </h1>
            {props.headerButton}
        </div>
    );

    // Map modalLocation to a CSS class.
    const locationClassMapping: Record<ModalLocation, string> = {
        top: 'GenericModal__location--top',
        center: 'GenericModal__location--center',
        bottom: 'GenericModal__location--bottom',
    };
    const modalLocationClass = locationClassMapping[modalLocation];

    // Accessibility labeling: if ariaLabelledby is provided, use it; otherwise default to 'genericModalLabel'
    const ariaLabelledby = props.ariaLabelledby || 'genericModalLabel';

    return (
        <Modal
            id={id}
            role='none'
            aria-label={props.ariaLabel}
            aria-labelledby={ariaLabelledby}
            aria-modal='true'
            dialogClassName={classNames(
                modalLocationClass,
                'a11y__modal GenericModal',
                {
                    GenericModal__compassDesign: props.compassDesign,
                    'modal--overflow': props.bodyOverflowVisible,
                },
                props.className,
            )}
            show={showState}
            restoreFocus={true}
            enforceFocus={enforceFocus}
            onHide={onHide}
            onExited={props.onExited}
            backdrop={props.backdrop}
            backdropClassName={props.backdropClassName}
            container={props.container}
            keyboard={keyboardEscape}
            onEntered={props.onEntered}
            data-testid={props.dataTestId}
        >
            <div
                ref={containerRef}
                onKeyDown={onEnterKeyDown}
                tabIndex={props.tabIndex || 0}
                className='GenericModal__wrapper GenericModal__wrapper-enter-key-press-catcher'
            >
                {showHeader && (
                    <Modal.Header closeButton={showCloseButton}>
                        <div className='GenericModal__header__text_container'>
                            {props.compassDesign && (
                                <>
                                    {headerText}
                                    {props.headerInput}
                                </>
                            )}
                            {props.modalSubheaderText && (
                                <div className='modal-subheading-container'>
                                    <div id='genericModalSubheading' className='modal-subheading'>
                                        {props.modalSubheaderText}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Modal.Header>
                )}
                <Modal.Body className={classNames({divider: props.bodyDivider, 'overflow-visible': props.bodyOverflowVisible})}>
                    {props.compassDesign ? (
                        props.errorText && (
                            <div className='genericModalError'>
                                <i className='icon icon-alert-outline'/>
                                <span>{props.errorText}</span>
                            </div>
                        )
                    ) : (
                        headerText
                    )}
                    <div className={classNames('GenericModal__body', {padding: bodyPadding})}>
                        {props.children}
                    </div>
                </Modal.Body>
                {(cancelButton || confirmButton || props.footerContent) && (
                    <Modal.Footer className={classNames({divider: props.footerDivider})}>
                        {(cancelButton || confirmButton) ? (
                            <>
                                {cancelButton}
                                {confirmButton}
                            </>
                        ) : (
                            props.footerContent
                        )}
                    </Modal.Footer>
                )}
                {Boolean(props.appendedContent) && props.appendedContent}
            </div>
        </Modal>
    );
};

export default GenericModal;
