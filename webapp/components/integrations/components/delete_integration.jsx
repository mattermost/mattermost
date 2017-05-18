import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import DeleteModalTrigger from '../../delete_modal_trigger.jsx';

export default class DeleteIntegration extends DeleteModalTrigger {
    get triggerTitle() {
        return (
            <FormattedMessage
                id='installed_integrations.delete'
                defaultMessage='Delete'
            />
        );
    }

    get modalTitle() {
        return (
            <FormattedMessage
                id='integrations.delete.confirm.title'
                defaultMessage='Delete Integration'
            />
        );
    }

    get modalMessage() {
        return (
            <div className='alert alert-warning'>
                <i className='fa fa-warning fa-margin--right'/>
                <FormattedMessage
                    id={this.props.messageId}
                    defaultMessage='This action permanently deletes the integration and breaks any integrations using it. Are you sure you want to delete it?'
                />
            </div>
        );
    }

    get modalConfirmButton() {
        return (
            <FormattedMessage
                id='integrations.delete.confirm.button'
                defaultMessage='Delete'
            />
        );
    }
}

DeleteIntegration.propTypes = {
    messageId: PropTypes.string.isRequired,
    onDelete: PropTypes.func.isRequired
};
