// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
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

    /**
     * Function called when modal is dismissed
     */
    onExited?: () => void;

    /*
     * Set to hide the cancel button
     */
    hideCancel?: boolean;

    /*
     * The element that triggered the modal
     */
    focusOriginElement?: string;

};

type State = {
    checked: boolean;
}

export default class ConfirmModal extends React.Component<Props, State> {
    static defaultProps = {
        title: '',
        message: '',
        confirmButtonClass: 'btn btn-primary',
        confirmButtonText: '',
        modalClass: '',
    };

    constructor(props: Props) {
        super(props);

        this.state = {
            checked: false,
        };
    }

    shouldComponentUpdate(nextProps: Props, nextState: State) {
        return (
            nextProps.show !== this.props.show ||
            nextState.checked !== this.state.checked
        );
    }

    handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({checked: e.target.checked});
    };

    handleConfirm = () => {
        this.props.onConfirm?.(this.state.checked);
    };

    handleCancel = () => {
        this.props.onCancel?.(this.state.checked);
    };

    handleExited = () => {
        this.props.onExited?.();
        if (this.props.focusOriginElement) {
            focusElement(this.props.focusOriginElement!, true);
        }
    };

    render() {
        let checkbox;
        if (this.props.showCheckbox) {
            checkbox = (
                <div className='checkbox text-right mb-0'>
                    <label>
                        <input
                            type='checkbox'
                            onChange={this.handleCheckboxChange}
                            checked={this.state.checked}
                        />
                        {this.props.checkboxText}
                    </label>
                </div>
            );
        }

        let cancelText;
        if (this.props.cancelButtonText) {
            cancelText = this.props.cancelButtonText;
        } else {
            cancelText = (
                <FormattedMessage
                    id='confirm_modal.cancel'
                    defaultMessage='Cancel'
                />
            );
        }

        let cancelButton;
        if (!this.props.hideCancel) {
            cancelButton = (
                <button
                    type='button'
                    data-testid='cancel-button'
                    className='btn btn-tertiary'
                    onClick={this.handleCancel}
                    id='cancelModalButton'
                >
                    {cancelText}
                </button>
            );
        }

        return (
            <GenericModal
                id={this.props.id || 'confirmModal'}
                className={`ConfirmModal a11y__modal ${this.props.modalClass}`}
                show={this.props.show}
                onHide={this.handleCancel}
                onExited={this.handleExited}
                ariaLabelledby='confirmModalLabel'
                compassDesign={true}
                modalHeaderText={this.props.title}
            >
                <div
                    data-testid={this.props.id}
                >
                    <div
                        className='ConfirmModal__body'
                        id='confirmModalBody'
                    >
                        {this.props.message}
                        {!this.props.checkboxInFooter && checkbox}
                    </div>
                    <div className='ConfirmModal__footer'>
                        {this.props.checkboxInFooter && checkbox}
                        {cancelButton}
                        <button
                            type='button'
                            className={this.props.confirmButtonClass}
                            onClick={this.handleConfirm}
                            id='confirmModalButton'
                            autoFocus={true}
                        >
                            {this.props.confirmButtonText}
                        </button>
                    </div>
                </div>
            </GenericModal>
        );
    }
}
