// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default function ManagedExternally(): JSX.Element {
    return (
        <div className='alert alert-warning'>
            <FormattedMessage
                id='admin.managed_externally'
                defaultMessage='This setting can only be changed through the configuration file, an environment variable, or mmctl --local. It cannot be changed through the System Console.'
            />
        </div>
    );
}
