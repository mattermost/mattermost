// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage} from 'mm-intl';
const Modal = ReactBootstrap.Modal;

export default class ConfirmModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleConfirm = this.handleConfirm.bind(this);
    }

    handleConfirm() {
        this.props.onConfirm();
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
                        className='btn btn-primary'
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
    confirmButton: ''
};
ConfirmModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    title: React.PropTypes.node,
    message: React.PropTypes.node,
    confirmButton: React.PropTypes.node,
    onConfirm: React.PropTypes.func.isRequired,
    onCancel: React.PropTypes.func.isRequired
};
