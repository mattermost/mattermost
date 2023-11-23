// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

type Props = {
    customDescriptionText?: string;
    siteName: string | undefined;
};
const SiteNameAndDescription = ({customDescriptionText, siteName = 'Mattermost'}: Props) => {
    const description = customDescriptionText || (
        <FormattedMessage
            id='web.root.signup_info'
            defaultMessage='All team communication in one place, searchable and accessible anywhere'
        />
    );

    return (
        <>
            <h1 id='site_name'>{siteName}</h1>
            <h3
                id='site_description'
                className='color--light'
            >
                {description}
            </h3>
        </>
    );
};

export default React.memo(SiteNameAndDescription);
