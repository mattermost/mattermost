// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

function SystemUsersExport() {
    return (
        <button className='btn btn-md btn-tertiary'>
            <span className='icon icon-download-outline'/>
            <FormattedMessage
                id='admin.system_users.exportButton'
                defaultMessage='Export'
            />
        </button>
    );
}

export default SystemUsersExport;
