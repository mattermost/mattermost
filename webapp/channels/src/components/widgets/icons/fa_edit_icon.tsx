// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function EditIcon() {
    const {formatMessage} = useIntl();
    return (
        <i
            className='icon-pencil-outline'
            title={formatMessage({id: 'generic_icons.edit', defaultMessage: 'Edit Icon'})}
        />
    );
}

