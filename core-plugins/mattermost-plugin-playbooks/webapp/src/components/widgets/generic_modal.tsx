// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import classNames from 'classnames';
import React, {ComponentType} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {DestructiveButton, PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';

type Props = {
    className?: string;
    onHide: () => void;
    onExited?: () => void;
    modalHeaderText?: React.ReactNode;
    modalHeaderSideText?: React.ReactNode;
    modalHeaderIcon?: React.ReactNode;
    show?: boolean;
    showCancel?: boolean;
    handleCancel?: (() => void) | null;
    handleConfirm?: (() => void) | null;
    confirmButtonText?: React.ReactNode;
    confirmButtonClassName?: string;
    cancelButtonText?: React.ReactNode;
    isConfirmDisabled?: boolean;
    isConfirmDestructive?: boolean;
    id: string;
    autoCloseOnCancelButton?: boolean;
    autoCloseOnConfirmButton?: boolean;
    enforceFocus?: boolean;
    footer?: React.ReactNode;
    components?: Partial<{
        Header: typeof Modal.Header;
        FooterContainer: ComponentType<{children: React.ReactNode}>;
    }>;
    adjustTop?: number;
    children?: React.ReactNode;
};

type State = {
    show: boolean;
};

export default class GenericModal extends React.PureComponent<Props, State> {
    static defaultProps: Partial<Props> = {
        id: 'genericModal',
        autoCloseOnCancelButton: true,
        autoCloseOnConfirmButton: true,
        enforceFocus: true,
    };

    state = {show: true};

    onHide = () => {
        this.setState({show: false}, () => {
            setTimeout(this.props.onHide, 150);
        });
    };

    handleCancel = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (this.props.autoCloseOnCancelButton) {
            this.onHide();
        }
        this.props.handleCancel?.();
    };

    handleConfirm = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (this.props.autoCloseOnConfirmButton) {
            this.onHide();
        }

        this.props.handleConfirm?.();
    };

    render() {
        let confirmButton;
        if (this.props.handleConfirm) {
            let confirmButtonText: React.ReactNode = <FormattedMessage defaultMessage='Confirm'/>;
            if (this.props.confirmButtonText) {
                confirmButtonText = this.props.confirmButtonText;
            }

            const ButtonComponent = this.props.isConfirmDestructive ? DestructiveButton : PrimaryButton;

            confirmButton = (
                <ButtonComponent
                    type='submit'
                    data-testid={'modal-confirm-button'}
                    className={classNames('confirm', this.props.confirmButtonClassName, {
                        disabled: this.props.isConfirmDisabled,
                    })}
                    onClick={this.handleConfirm}
                    disabled={this.props.isConfirmDisabled}
                >
                    {confirmButtonText}
                </ButtonComponent>
            );
        }

        let cancelButton;
        if (this.props.handleCancel || this.props.showCancel) {
            let cancelButtonText: React.ReactNode = <FormattedMessage defaultMessage='Cancel'/>;
            if (this.props.cancelButtonText) {
                cancelButtonText = this.props.cancelButtonText;
            }

            cancelButton = (
                <TertiaryButton
                    data-testid={'modal-cancel-button'}
                    type='button'
                    className='cancel'
                    onClick={this.handleCancel}
                >
                    {cancelButtonText}
                </TertiaryButton>
            );
        }

        const Header = this.props.components?.Header || Modal.Header;
        const FooterContainer = this.props.components?.FooterContainer || DefaultFooterContainer;
        const showFooter = Boolean(confirmButton || cancelButton || this.props.footer !== undefined);

        return (
            <StyledModal
                dialogClassName={classNames('a11y__modal GenericModal', this.props.className)}
                show={this.props.show ?? this.state.show}
                onHide={this.onHide}
                onExited={this.props.onExited || this.onHide}
                enforceFocus={this.props.enforceFocus}
                restoreFocus={true}
                role='dialog'
                aria-labelledby={`${this.props.id}_heading`}
                id={this.props.id}
                container={document.getElementById('root-portal')}
            >
                <Header
                    className='GenericModal__header'
                    closeButton={true}
                    placeholder={undefined}
                    onPointerEnterCapture={undefined}
                    onPointerLeaveCapture={undefined}
                >
                    {Boolean(this.props.modalHeaderText) && (
                        <ModalHeading id={`${this.props.id}_heading`}>{this.props.modalHeaderText}</ModalHeading>
                    )}
                </Header>
                <>
                    <Modal.Body>{this.props.children}</Modal.Body>
                    {showFooter ? (
                        <Modal.Footer>
                            <FooterContainer>
                                <Buttons>
                                    {cancelButton}
                                    {confirmButton}
                                </Buttons>
                                {this.props.footer}
                            </FooterContainer>
                        </Modal.Footer>
                    ) : null}
                </>
            </StyledModal>
        );
    }
}

export const StyledModal = styled(Modal)`
    &&&& {
        display: grid !important;
        padding: 8px;
        grid-template-rows: 1fr auto 2fr;
        place-content: start center;

        /* content-spacing */
        .modal-body {
            overflow: visible;
            padding: 0 32px;
        }

        .modal-dialog {
            max-width: 100%;
            margin: 0 !important;
            grid-row: 2;
        }

        /* control correction-overrides */
        .form-control {
            border: none;
        }

        input.form-control {
            padding-left: 16px;
        }
    }
`;

export const Buttons = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: center;
    gap: 10px;
`;

export const DefaultFooterContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
`;

export const ModalHeading = styled.h1`
    margin: 0;
    color: var(--center-channel-color);
    font-size: 22px;
    line-height: 28px;
    align-self: center;
`;

export const ModalSideheading = styled.h6`
    padding-left: 8px;
    border-left: solid 1px rgba(var(--center-channel-color-rgb), 0.56);
    margin: 0 0 0 8px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
    line-height: 20px;
`;

export const ModalSubheading = styled.h6`
    margin-top: 6px;
    margin-bottom: 0;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-family: 'Open Sans';
    font-size: 12px;
    line-height: 16px;
`;

export const Description = styled.p`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
    line-height: 16px;

    a {
        font-weight: bold;
    }
`;

export const Label = styled.label`
    margin-top: 24px;
    margin-bottom: 8px;
    color: var(--center-channel-color);
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
`;

export const InlineLabel = styled.label`
    z-index: 1;
    width: max-content;
    padding: 0 3px;
    margin: 0 0 -8px 12px;
    background: var(--center-channel-bg);
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 10px;
    font-weight: normal;
    line-height: 14px;
`;
