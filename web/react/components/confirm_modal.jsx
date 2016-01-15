// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
import {intlShape, injectIntl, defineMessages} from 'react-intl';

const Modal = ReactBootstrap.Modal;

const messages = defineMessages({
    cancel: {
        id: 'confirm_modal.cancel',
        defaultMessage: 'Cancel'
    }
});

class ConfirmModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleConfirm = this.handleConfirm.bind(this);
    }

    handleConfirm() {
        this.props.onConfirm();
    }

    render() {
        const {formatMessage} = this.props.intl;
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
                        {formatMessage(messages.cancel)}
                    </button>
                    <button
                        type='button'
                        className='btn btn-primary'
                        onClick={this.props.onConfirm}
                    >
                        {this.props.confirm_button}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

ConfirmModal.defaultProps = {
    title: '',
    message: '',
    confirm_button: ''
};
ConfirmModal.propTypes = {
    intl: intlShape.isRequired,
    show: React.PropTypes.bool.isRequired,
    title: React.PropTypes.string,
    message: React.PropTypes.string,
    confirm_button: React.PropTypes.string,
    onConfirm: React.PropTypes.func.isRequired,
    onCancel: React.PropTypes.func.isRequired
};

export default injectIntl(ConfirmModal);