import React from 'react';
import {FormattedMessage} from 'react-intl';

import ConfirmModal from '../../confirm_modal.jsx';

export default class DeleteIntegration extends React.Component {
    constructor(props) {
        super(props);

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

    handleConfirm() {
        this.props.onDelete();
    }

    handleCancel() {
        this.setState({
            showDeleteModal: false
        });
    }

    render() {
        const title = (
            <FormattedMessage
                id='integrations.delete.confirm.title'
                defaultMessage='Delete Integration'
            />
        );

        const message = (
            <div className='alert alert-warning'>
                <i className='fa fa-warning'/>
                <FormattedMessage
                    id={this.props.messageId}
                    defaultMessage='This action permanently deletes the integration and breaks any integrations using it. Are you sure you want to delete it?'
                />
            </div>
        );

        const confirmButton = (
            <FormattedMessage
                id='integrations.delete.confirm.button'
                defaultMessage='Delete'
            />
        );

        return (
            <span>
                <a
                    href='#'
                    onClick={this.handleOpenModal}
                >
                    <FormattedMessage
                        id='installed_integrations.delete'
                        defaultMessage='Delete'
                    />
                </a>
                <ConfirmModal
                    show={this.state.showDeleteModal}
                    title={title}
                    message={message}
                    confirmButton={confirmButton}
                    onConfirm={this.handleConfirm}
                    onCancel={this.handleCancel}
                />
            </span>
        );
    }
}

DeleteIntegration.propTypes = {
    messageId: React.PropTypes.string.isRequired,
    onDelete: React.PropTypes.func.isRequired
};
