import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';

export default class SaveButton extends React.Component {
    static get propTypes() {
        return {
            saving: PropTypes.bool.isRequired,
            disabled: PropTypes.bool,
            messageId: PropTypes.string
        };
    }

    static get defaultProps() {
        return {
            disabled: false
        };
    }

    render() {
        const {saving, disabled, messageId, ...props} = this.props; // eslint-disable-line no-use-before-define

        let contents;
        if (saving) {
            contents = (
                <span>
                    <span className='icon fa fa-refresh icon--rotate'/>
                    <FormattedMessage
                        id={messageId || 'admin.saving'}
                        defaultMessage='Saving Config...'
                    />
                </span>
            );
        } else {
            contents = (
                <FormattedMessage
                    id='admin.save'
                    defaultMessage='Save'
                />
            );
        }

        let className = 'save-button btn';
        if (!disabled) {
            className += ' btn-primary';
        }

        return (
            <button
                type='submit'
                id='saveSetting'
                className={className}
                disabled={disabled}
                {...props}
            >
                {contents}
            </button>
        );
    }
}
