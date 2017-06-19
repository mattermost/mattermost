import PropTypes from 'prop-types';
import React from 'react';

import ConfirmModal from './confirm_modal.jsx';
import Constants from 'utils/constants.jsx';

export default class DeleteModalTrigger extends React.Component {
    constructor(props) {
        super(props);
        if (this.constructor === DeleteModalTrigger) {
            throw new TypeError('Can not construct abstract class.');
        }
        this.handleConfirm = this.handleConfirm.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.handleOpenModal = this.handleOpenModal.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);

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

    handleConfirm() {
        this.props.onDelete();
    }

    handleCancel() {
        this.setState({
            showDeleteModal: false
        });
    }

    handleKeyDown(e) {
        if (e.keyCode === Constants.KeyCodes.ENTER) {
            this.handleConfirm(e);
        }
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
                    confirmButtonText={this.modalConfirmButton}
                    onConfirm={this.handleConfirm}
                    onCancel={this.handleCancel}
                    onKeyDown={this.handleKeyDown}
                />
            </span>
        );
    }
}

DeleteModalTrigger.propTypes = {
    onDelete: PropTypes.func.isRequired
};
