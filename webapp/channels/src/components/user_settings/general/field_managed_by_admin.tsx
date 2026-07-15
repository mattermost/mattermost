// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default function FieldManagedByAdmin() {
    return (
        <span>
            <FormattedMessage
                id='user.settings.general.field_locked_by_admin'
                defaultMessage='This field is managed by your System Admin. Contact them to request a change.'
            />
        </span>
    );
}
