// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

type Props = {
    url: string;
    messageId: string;
    defaultMessage: string;
}

const ErrorLink: React.FC<Props> = ({url, messageId, defaultMessage}: Props) => {
    return (
        <a
            href={url}
            rel='noopener noreferrer'
            target='_blank'
        >
            <FormattedMessage
                id={messageId}
                defaultMessage={defaultMessage}
            />
        </a>
    );
};

ErrorLink.defaultProps = {
    url: '',
    messageId: '',
    defaultMessage: '',
};

export default ErrorLink;
