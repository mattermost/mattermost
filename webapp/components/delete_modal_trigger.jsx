import React from 'react';

import ConfirmModal from './confirm_modal.jsx';

export default class DeleteModalTrigger extends React.Component {
    constructor(props) {
        super(props);
        if (this.constructor === DeleteModalTrigger) {
            throw new TypeError('Can not construct abstract class.');
        }
        this.handleConfirm = this.handleConfirm.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.handleOpenModal = this.handleOpenModal.bind(this);

        this.state = {
            showDeleteModal: false
        };
    }

    handleOpenModal(e) {
        e.preventDefault();

        this.setState({
            showDeleteModal: true
        });
    }

    handleConfirm(e) {
        this.props.onDelete(e);
    }

    handleCancel() {
        this.setState({
            showDeleteModal: false
        });
    }

    render() {
        return (
            <span>
                <a
                    href='#'
                    onClick={this.handleOpenModal}
                >
                    { this.triggerTitle }
                </a>
                <ConfirmModal
                    show={this.state.showDeleteModal}
                    title={this.modalTitle}
                    message={this.modalMessage}
                    confirmButton={this.modalConfirmButton}
                    onConfirm={this.handleConfirm}
                    onCancel={this.handleCancel}
                />
            </span>
        );
    }
}

DeleteModalTrigger.propTypes = {
    onDelete: React.PropTypes.func.isRequired
};
