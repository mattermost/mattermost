// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {FormattedMessage} from 'react-intl';

export default class RevokeTokenButton extends React.PureComponent {
    static propTypes = {

        /*
         * Token id to revoke
         */
        tokenId: PropTypes.string.isRequired,

        /*
         * Function to call on error
         */
        onError: PropTypes.func.isRequired,

        actions: PropTypes.shape({

            /**
             * Function to revoke a user access token
             */
            revokeUserAccessToken: PropTypes.func.isRequired
        }).isRequired
    };

    handleClick = async (e) => {
        e.preventDefault();

        const {error} = await this.props.actions.revokeUserAccessToken(this.props.tokenId);

        if (error) {
            this.props.onError(error.message);
        }
    }

    render() {
        return (
            <button
                className='btn btn-default'
                onClick={this.handleClick}
            >
                <FormattedMessage
                    id='admin.revoke_token_button.delete'
                    defaultMessage='Delete'
                />
            </button>
        );
    }
}
