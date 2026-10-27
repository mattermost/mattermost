// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import CopyText from 'components/copy_text';
import WarningIcon from 'components/widgets/icons/fa_warning_icon';

const copySecretMessage = defineMessage({id: 'bots.event_delivery.secret.copy', defaultMessage: 'Copy Secret'});

type Props = {
    secret: string;
    children?: ReactNode;
};

export default function BotEventSecret({secret, children}: Props) {
    return (
        <div className='alert alert-warning'>
            <div className='mb-2'>
                <WarningIcon additionalClassName='mr-2'/>
                <FormattedMessage
                    id='bots.event_delivery.secret'
                    defaultMessage="Copy this signing secret now. You won't be able to see it again! Use it to verify the X-Mattermost-Signature header on push requests."
                />
            </div>
            <strong className='word-break--all'>
                <code>{secret}</code>
            </strong>
            <CopyText
                label={copySecretMessage}
                value={secret}
            />
            {children}
        </div>
    );
}
