// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function ReloadIcon() {
    const {formatMessage} = useIntl();
    return (
        <i
            className='fa fa-refresh'
            title={formatMessage({id: 'generic_icons.reload', defaultMessage: 'Reload Icon'})}
        />
    );
}

