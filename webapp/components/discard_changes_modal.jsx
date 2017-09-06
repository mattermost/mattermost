// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {FormattedMessage} from 'react-intl';

import ConfirmModal from 'components/confirm_modal.jsx';

export default class DiscardChangesModal extends React.Component {
    static propTypes = {

        /*
         * Bool whether the modal is shown
         */
        show: PropTypes.bool.isRequired,

        /*
         * Action to call on confirm
         */
        onConfirm: PropTypes.func.isRequired,

        /*
         * Action to call on cancel
         */
        onCancel: PropTypes.func.isRequired

    }

    render() {
        const title = (
            <FormattedMessage
                id='discard_changes_modal.title'
                defaultMessage='Discard Changes?'
            />
        );

        const message = (
            <FormattedMessage
                id='discard_changes_modal.message'
                defaultMessage='You have unsaved changes, are you sure you want to discard them?'
            />
        );

        const buttonClass = 'btn btn-primary';
        const button = (
            <FormattedMessage
                id='discard_changes_modal.leave'
                defaultMessage='Yes, Discard'
            />
        );

        const modalClass = 'discard-changes-modal';

        const {show, onConfirm, onCancel} = this.props;

        return (
            <ConfirmModal
                show={show}
                title={title}
                message={message}
                modalClass={modalClass}
                confirmButtonClass={buttonClass}
                confirmButtonText={button}
                onConfirm={onConfirm}
                onCancel={onCancel}
            />
        );
    }
}
