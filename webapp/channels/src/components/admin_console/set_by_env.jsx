// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default function SetByEnv() {
    return (
        <div className='alert alert-warning'>
            <FormattedMessage
                id='admin.set_by_env'
                defaultMessage='This setting has been set through an environment variable. It cannot be changed through the System Console.'
            />
        </div>
    );
}
