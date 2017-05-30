// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage} from 'react-intl';
import {Modal} from 'react-bootstrap';

import PropTypes from 'prop-types';

import React from 'react';

export default class ConfirmModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleKeypress = this.handleKeypress.bind(this);
    }

    componentDidMount() {
        if (this.props.show) {
            document.addEventListener('keypress', this.handleKeypress);
        }
    }

    componentWillUnmount() {
        if (!this.props.show) {
            document.removeEventListener('keypress', this.handleKeypress);
        }
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.show && !nextProps.show) {
            document.removeEventListener('keypress', this.handleKeypress);
        } else if (!this.props.show && nextProps.show) {
            document.addEventListener('keypress', this.handleKeypress);
        }
    }

    handleKeypress(e) {
        if (e.key === 'Enter' && this.props.show) {
            this.props.onConfirm();
        }
    }

    render() {
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
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.props.onCancel}
                    >
                        <FormattedMessage
                            id='confirm_modal.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    <button
                        type='button'
                        className={this.props.confirmButtonClass}
                        onClick={this.props.onConfirm}
                    >
                        {this.props.confirmButton}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

ConfirmModal.defaultProps = {
    title: '',
    message: '',
    confirmButtonClass: 'btn btn-primary',
    confirmButton: ''
};
ConfirmModal.propTypes = {
    show: PropTypes.bool.isRequired,
    title: PropTypes.node,
    message: PropTypes.node,
    confirmButtonClass: PropTypes.string,
    confirmButton: PropTypes.node,
    onConfirm: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
};
