// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import type {ActionResult} from 'mattermost-redux/types/actions';

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

        if ('error' in response) {
            props.onError(response.error.message);
        }
    };

    return (
        <Button
            type='button'
            variant='destructive'
            onClick={handleClick}
        >
            <FormattedMessage
                id='admin.revoke_token_button.delete'
                defaultMessage='Delete'
            />
        </Button>
    );
};

export default React.memo(RevokeTokenButton);
