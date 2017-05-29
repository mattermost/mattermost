import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import DeleteModalTrigger from '../../delete_modal_trigger.jsx';

export default class DeleteEmoji extends DeleteModalTrigger {
    get triggerTitle() {
        return (
            <FormattedMessage
                id='emoji_list.delete'
                defaultMessage='Delete'
            />
        );
    }

    get modalTitle() {
        return (
            <FormattedMessage
                id='emoji_list.delete.confirm.title'
                defaultMessage='Delete Custom Emoji'
            />
        );
    }

    get modalMessage() {
        return (
            <div className='alert alert-warning'>
                <i className='fa fa-warning fa-margin--right'/>
                <FormattedMessage
                    id='emoji_list.delete.confirm.msg'
                    defaultMessage='This action permanently deletes the custom emoji. Are you sure you want to delete it?'
                />
            </div>
        );
    }

    get modalConfirmButton() {
        return (
            <FormattedMessage
                id='emoji_list.delete.confirm.button'
                defaultMessage='Delete'
            />
        );
    }
}

DeleteEmoji.propTypes = {
    onDelete: PropTypes.func.isRequired
};
