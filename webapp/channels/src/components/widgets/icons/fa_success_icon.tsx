// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function SuccessIcon() {
    const {formatMessage} = useIntl();

    return (
        <i
            className='fa fa-check'
            title={formatMessage({id: 'generic_icons.success', defaultMessage: 'Success Icon'})}
        />
    );
}
