// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {ActionFunc, ActionResult} from 'mattermost-redux/types/actions';

import {trackEvent} from 'actions/telemetry_actions.jsx';
interface RevokeTokenButtonProps {
    actions: {
        revokeUserAccessToken: (tokenId: string) => Promise<ActionFunc | ActionResult> | ActionFunc | ActionResult;
    };
    tokenId: string;
    onError: (errorMessage: string) => void;
}

export default class RevokeTokenButton extends React.PureComponent<RevokeTokenButtonProps> {
    private handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();

        const response = await this.props.actions.revokeUserAccessToken(this.props.tokenId);
        trackEvent('system_console', 'revoke_user_access_token');

        if ('error' in response) {
            this.props.onError(response.error.message);
        }
    }

    render() {
        return (
            <button
                type='button'
                className='btn btn-danger'
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
