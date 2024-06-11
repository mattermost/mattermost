// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import ExternalLink from 'components/external_link';

type Props = {
    url: string;
    message: MessageDescriptor;
}

const ErrorLink: React.FC<Props> = ({url, message}: Props) => {
    return (
        <ExternalLink
            href={url}
            location='error_link'
        >
            <FormattedMessage {...message}/>
        </ExternalLink>
    );
};

ErrorLink.defaultProps = {
    url: '',
};

export default ErrorLink;
