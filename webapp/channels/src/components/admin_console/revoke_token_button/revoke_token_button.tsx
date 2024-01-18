// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {trackEvent} from 'actions/telemetry_actions.jsx';

export interface RevokeTokenButtonProps {
    actions: {
        revokeUserAccessToken: (
            tokenId: string
        ) => Promise<ActionResult>;
    };
    tokenId: string;
    onError: (errorMessage: string) => void;
}

const RevokeTokenButton = (props: RevokeTokenButtonProps) => {
    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();

        const response = await props.actions.revokeUserAccessToken(props.tokenId);
        trackEvent('system_console', 'revoke_user_access_token');

        if ('error' in response) {
            props.onError(response.error.message);
        }
    };

    return (
        <button
            type='button'
            className='btn btn-danger'
            onClick={handleClick}
        >
            <FormattedMessage
                id='admin.revoke_token_button.delete'
                defaultMessage='Delete'
            />
        </button>
    );
};

export default React.memo(RevokeTokenButton);
