// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function AddIcon() {
    const {formatMessage} = useIntl();
    return (
        <i
            className='fa fa-plus'
            title={formatMessage({id: 'generic_icons.add', defaultMessage: 'Add Icon'})}
        />
    );
}
