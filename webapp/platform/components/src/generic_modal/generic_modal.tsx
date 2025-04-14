// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

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
    id: string;
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
};

type State = {
    show: boolean;
    isFocalTrapActive: boolean;
}
export class GenericModal extends React.PureComponent<Props, State> {
    static defaultProps: Partial<Props> = {
        show: true,
        id: 'genericModal',
        autoCloseOnCancelButton: true,
        autoCloseOnConfirmButton: true,
        enforceFocus: true,
        keyboardEscape: true,
        bodyPadding: true,
        showCloseButton: true,
        showHeader: true,
        modalLocation: 'center',
    };

    constructor(props: Props) {
        super(props);

        this.state = {
            show: props.show!,
            isFocalTrapActive: false,
        };
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.show !== this.props.show) {
            this.setState({show: Boolean(this.props.show)});
        }
    }

    onHide = () => {
        this.setState({show: false});
        this.props.onHide?.();
    };

    handleCancel = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (this.props.autoCloseOnCancelButton) {
            this.onHide();
        }
        if (this.props.handleCancel) {
            this.props.handleCancel();
        }
    };

    handleConfirm = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (this.props.autoCloseOnConfirmButton) {
            this.onHide();
        }
        if (this.props.handleConfirm) {
            this.props.handleConfirm();
        }
    };

    private onEnterKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter') {
            if (event.nativeEvent.isComposing) {
                return;
            }
            if (this.props.handleConfirm && this.props.autoCloseOnConfirmButton) {
                this.onHide();
            }
            if (this.props.handleEnterKeyPress) {
                this.props.handleEnterKeyPress();
            }
        }
        this.props.handleKeydown?.(event);
    };

    render() {
        let confirmButton;
        if (this.props.handleConfirm) {
            const isConfirmOrDeleteClassName = this.props.isDeleteModal ? 'delete' : 'confirm';
            let confirmButtonText: React.ReactNode = (
                <FormattedMessage
                    id='generic_modal.confirm'
                    defaultMessage='Confirm'
                />
            );
            if (this.props.confirmButtonText) {
                confirmButtonText = this.props.confirmButtonText;
            }

            confirmButton = (
                <button
                    autoFocus={this.props.autoFocusConfirmButton}
                    type='submit'
                    className={classNames('GenericModal__button btn btn-primary', isConfirmOrDeleteClassName, this.props.confirmButtonClassName, {
                        disabled: this.props.isConfirmDisabled,
                    })}
                    onClick={this.handleConfirm}
                    disabled={this.props.isConfirmDisabled}
                >
                    {confirmButtonText}
                </button>
            );
        }

        let cancelButton;
        if (this.props.handleCancel) {
            let cancelButtonText: React.ReactNode = (
                <FormattedMessage
                    id='generic_modal.cancel'
                    defaultMessage='Cancel'
                />
            );
            if (this.props.cancelButtonText) {
                cancelButtonText = this.props.cancelButtonText;
            }

            cancelButton = (
                <button
                    type='button'
                    className={classNames('GenericModal__button btn btn-tertiary', this.props.cancelButtonClassName)}
                    onClick={this.handleCancel}
                >
                    {cancelButtonText}
                </button>
            );
        }

        const headerText = this.props.modalHeaderText && (
            <div className='GenericModal__header'>
                <h1
                    id='genericModalLabel'
                    className='modal-title'
                >
                    {this.props.modalHeaderText}
                </h1>
                {this.props.headerButton}
            </div>
        );

        const locationClassMapping: Record<Required<Props>['modalLocation'], string> = {
            top: 'GenericModal__location--top',
            center: 'GenericModal__location--center',
            bottom: 'GenericModal__location--bottom',
        };

        const modalLocationClass = locationClassMapping[this.props.modalLocation ?? 'center'];

        // Accessibility labeling strategy:
        // 1. We always set aria-labelledby to ensure the modal has a proper label
        //    - First try to use the provided ariaLabeledBy prop
        //    - Fall back to 'genericModalLabel' which references the modal title
        // 2. We also support aria-label as a secondary option
        //    - This will only be used by screen readers if the element referenced by aria-labelledby doesn't exist
        //    - This provides a fallback for accessibility in case the referenced element is missing
        // Note: When both aria-labelledby and aria-label are present, aria-labelledby takes precedence
        const ariaLabelledby = this.props.ariaLabelledby || 'genericModalLabel';

        return (
            <Modal
                id={this.props.id}
                role='none'
                aria-label={this.props.ariaLabel}
                aria-labelledby={ariaLabelledby}
                aria-modal='true'
                dialogClassName={classNames(
                    modalLocationClass,
                    'a11y__modal GenericModal',
                    {
                        GenericModal__compassDesign: this.props.compassDesign,
                        'modal--overflow': this.props.bodyOverflowVisible,
                    },
                    this.props.className,
                )}
                show={this.state.show}
                restoreFocus={true}
                enforceFocus={this.props.enforceFocus}
                onHide={this.onHide}
                onExited={this.props.onExited}
                backdrop={this.props.backdrop}
                backdropClassName={this.props.backdropClassName}
                container={this.props.container}
                keyboard={this.props.keyboardEscape}
                onEntered={this.props.onEntered}
                data-testid={this.props.dataTestId}
            >
                <div
                    onKeyDown={this.onEnterKeyDown}
                    tabIndex={this.props.tabIndex || 0}
                    className='GenericModal__wrapper GenericModal__wrapper-enter-key-press-catcher'
                >
                    {this.props.showHeader && <Modal.Header closeButton={this.props.showCloseButton}>
                        <div
                            className='GenericModal__header__text_container'
                        >
                            {this.props.compassDesign && (
                                <>
                                    {headerText}
                                    {this.props.headerInput}
                                </>
                            )}
                            {
                                this.props.modalSubheaderText &&
                                <div className='modal-subheading-container'>
                                    <div
                                        id='genericModalSubheading'
                                        className='modal-subheading'
                                    >
                                        {this.props.modalSubheaderText}
                                    </div>
                                </div>
                            }
                        </div>
                    </Modal.Header>}
                    <Modal.Body className={classNames({divider: this.props.bodyDivider, 'overflow-visible': this.props.bodyOverflowVisible})}>
                        {this.props.compassDesign ? (
                            this.props.errorText && (
                                <div className='genericModalError'>
                                    <i className='icon icon-alert-outline'/>
                                    <span>{this.props.errorText}</span>
                                </div>
                            )
                        ) : (
                            headerText
                        )}
                        <div className={classNames('GenericModal__body', {padding: this.props.bodyPadding})}>
                            {this.props.children}
                        </div>
                    </Modal.Body>
                    {(cancelButton || confirmButton || this.props.footerContent) && (
                        <Modal.Footer className={classNames({divider: this.props.footerDivider})}>
                            {(cancelButton || confirmButton) ? (
                                <>
                                    {cancelButton}
                                    {confirmButton}
                                </>
                            ) : (
                                this.props.footerContent
                            )}
                        </Modal.Footer>
                    )}
                    {Boolean(this.props.appendedContent) && this.props.appendedContent}
                </div>
            </Modal>
        );
    }
}
