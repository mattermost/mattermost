// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import type {SharedChannelInvitation} from '@mattermost/types/shared_channels';

import {LinkButton} from 'components/admin_console/secure_connections/controls';

const BusyInline = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 6px;
`;

function invitationIsRemovable(status: SharedChannelInvitation['status']) {
    return status === 'pending' || status === 'failed';
}

type RemoveInvitationCellProps = {
    invitation: SharedChannelInvitation;
    disabled: boolean;
    busy: boolean;
    onRemove: () => void;
};

const removeMessage = defineMessage({
    id: 'admin.secure_connections.shared_channels.invitations.remove',
    defaultMessage: 'Remove',
});

export function RemoveInvitationCell({
    invitation,
    disabled,
    busy,
    onRemove,
}: RemoveInvitationCellProps) {
    if (!invitationIsRemovable(invitation.status)) {
        // eslint-disable-next-line formatjs/no-literal-string-in-jsx
        return <span className='text-muted'>{'—'}</span>;
    }

    return (
        <LinkButton
            type='button'
            $destructive={true}
            disabled={disabled || busy}
            onClick={onRemove}
        >
            {busy ? (
                <BusyInline>
                    <span
                        aria-hidden='true'
                        className='fa fa-spinner fa-pulse'
                    />
                    <FormattedMessage {...removeMessage}/>
                </BusyInline>
            ) : (
                <FormattedMessage {...removeMessage}/>
            )}
        </LinkButton>
    );
}
