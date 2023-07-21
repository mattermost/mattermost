// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericModal} from '@mattermost/components';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

type Props = {
    displayName: string;
    onConfirm: () => void;
    onExited: () => void;
}

function SendDraftModal({
    displayName,
    onConfirm,
    onExited,
}: Props) {
    const {formatMessage} = useIntl();

    const title = formatMessage({
        id: 'drafts.confirm.send.title',
        defaultMessage: 'Send message now',
    });

    const confirmButtonText = formatMessage({
        id: 'drafts.confirm.send.button',
        defaultMessage: 'Yes, send now',
    });

    const message = (
        <FormattedMessage
            id={'drafts.confirm.send.text'}
            defaultMessage={'Are you sure you want to send this message to <strong>{displayName}</strong>?'}
            values={{
                strong: (chunk: string) => <strong>{chunk}</strong>,
                displayName,
            }}
        />
    );

    return (
        <GenericModal
            confirmButtonText={confirmButtonText}
            handleCancel={() => {}}
            handleConfirm={onConfirm}
            modalHeaderText={title}
            onExited={onExited}
            compassDesign={true}
        >
            {message}
        </GenericModal>
    );
}

export default SendDraftModal;
