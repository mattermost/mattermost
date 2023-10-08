// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React,{useState, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';

import type {ActionFunc, ActionResult} from 'mattermost-redux/types/actions';

import {trackEvent} from 'actions/telemetry_actions.jsx';

interface RevokeTokenButtonProps {
    actions: {
        revokeUserAccessToken: (tokenId: string) => Promise<ActionFunc | ActionResult> | ActionFunc | ActionResult;
    };
    tokenId: string;
    onError: (errorMessage: string) => void;
}

const RevokeTokenButton: React.FC<RevokeTokenButtonProps> = (props) => {
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (error) {
            props.onError(error);
        }
    }, [error, props]);

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();

        try {
            const response = await props.actions.revokeUserAccessToken(props.tokenId);
            trackEvent('system_console', 'revoke_user_access_token');

            if ('error' in response) {
                setError(response.error.message);
            }
        } catch (err) {
            setError(err.message);
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

export default RevokeTokenButton;
