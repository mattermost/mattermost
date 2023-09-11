// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ExternalLink from 'components/external_link';

type Props = {
    url: string;
    messageId: string;
    defaultMessage: string;
}

const ErrorLink: React.FC<Props> = ({url, messageId, defaultMessage}: Props) => {
    return (
        <ExternalLink
            href={url}
            location='error_link'
        >
            <FormattedMessage
                id={messageId}
                defaultMessage={defaultMessage}
            />
        </ExternalLink>
    );
};

ErrorLink.defaultProps = {
    url: '',
    messageId: '',
    defaultMessage: '',
};

export default ErrorLink;
