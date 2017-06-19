// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import PropTypes from 'prop-types';
import {FormattedMessage} from 'react-intl';

export default class ConfirmModal extends React.Component {
    static propTypes = {

        /*
         * Set to show modal
         */
        show: PropTypes.bool.isRequired,

        /*
         * Title to use for the modal
         */
        title: PropTypes.node,

        /*
         * Message to display in the body of the modal
         */
        message: PropTypes.node,

        /*
         * The CSS class to apply to the confirm button
         */
        confirmButtonClass: PropTypes.string,

        /*
         * Text/jsx element on the confirm button
         */
        confirmButtonText: PropTypes.node,

        /*
         * Text/jsx element on the cancel button
         */
        cancelButtonText: PropTypes.node,

        /*
         * Set to show checkbox
         */
        showCheckbox: PropTypes.bool,

        /*
         * Text/jsx element to display with the checkbox
         */
        checkboxText: PropTypes.node,

        /*
         * Function called when the confirm button or ENTER is pressed. Passes `true` if the checkbox is checked
         */
        onConfirm: PropTypes.func.isRequired,

        /*
         * Function called when the cancel button is pressed or the modal is hidden. Passes `true` if the checkbox is checked
         */
        onCancel: PropTypes.func.isRequired
    }

    static defaultProps = {
        title: '',
        message: '',
        confirmButtonClass: 'btn btn-primary',
        confirmButtonText: ''
    }

    componentDidMount() {
        if (this.props.show) {
            document.addEventListener('keypress', this.handleKeypress);
        }
    }

    componentWillUnmount() {
        document.removeEventListener('keypress', this.handleKeypress);
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.show && !nextProps.show) {
            document.removeEventListener('keypress', this.handleKeypress);
        } else if (!this.props.show && nextProps.show) {
            document.addEventListener('keypress', this.handleKeypress);
        }
    }

    handleKeypress = (e) => {
        if (e.key === 'Enter' && this.props.show) {
            this.handleConfirm();
        }
    }

    handleConfirm = () => {
        const checked = this.refs.checkbox ? this.refs.checkbox.checked : false;
        this.props.onConfirm(checked);
    }

    handleCancel = () => {
        const checked = this.refs.checkbox ? this.refs.checkbox.checked : false;
        this.props.onCancel(checked);
    }

    render() {
        let checkbox;
        if (this.props.showCheckbox) {
            checkbox = (
                <div className='checkbox text-right margin-bottom--none'>
                    <label>
                        <input
                            ref='checkbox'
                            type='checkbox'
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

        return (
            <Modal
                className='modal-confirm'
                show={this.props.show}
                onHide={this.props.onCancel}
            >
                <Modal.Header closeButton={false}>
                    <Modal.Title>{this.props.title}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {this.props.message}
                    {checkbox}
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.handleCancel}
                    >
                        {cancelText}
                    </button>
                    <button
                        type='button'
                        className={this.props.confirmButtonClass}
                        onClick={this.handleConfirm}
                    >
                        {this.props.confirmButtonText}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}
