// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getSubscriptionProductName} from 'mattermost-redux/selectors/entities/cloud';

export default function CloudArchived() {
    const planName = useSelector(getSubscriptionProductName);
    return (
        <FormattedMessage
            id='cloud_archived.error.access'
            defaultMessage='Permalink belongs to a message that has been archived because of {planName} limits. Upgrade to access message again.'
            values={{
                planName,
            }}
        />
    );
}
