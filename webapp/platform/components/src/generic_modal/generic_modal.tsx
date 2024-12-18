// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import './generic_modal.scss';

export type Props = {
    className?: string;
    onExited: () => void;
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
    };

    constructor(props: Props) {
        super(props);

        this.state = {
            show: props.show!,
            isFocalTrapActive: false,
        };
    }

    onHide = () => {
        this.setState({show: false});
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
            if (this.props.autoCloseOnConfirmButton) {
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

        return (
            <Modal
                id={this.props.id}
                role='none'
                aria-label={this.props.ariaLabel}
                aria-labelledby={this.props.ariaLabel ? undefined : 'genericModalLabel'}
                dialogClassName={classNames(
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
            >
                <div
                    onKeyDown={this.onEnterKeyDown}
                    tabIndex={this.props.tabIndex || 0}
                    className='GenericModal__wrapper-enter-key-press-catcher'
                >
                    <Modal.Header closeButton={true}>
                        <div className='GenericModal__header__text_container'>
                            {this.props.compassDesign && (
                                <>
                                    {headerText}
                                    {this.props.headerInput}
                                </>
                            )}

                            {
                                this.props.modalSubheaderText &&
                                <div className='modal-subheading-container'>
                                    <p
                                        id='genericModalSubheading'
                                        className='modal-subheading'
                                    >
                                        {this.props.modalSubheaderText}
                                    </p>
                                </div>
                            }
                        </div>
                    </Modal.Header>
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
