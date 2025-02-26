// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';

import {retryFailedCloudFetches} from 'actions/cloud';

import './cloud_fetch_error.scss';

export default function CloudFetchError() {
    const dispatch = useDispatch();
    const isCloud = useSelector(isCurrentLicenseCloud);
    if (!isCloud) {
        return null;
    }

    return (<div className='CloudFetchError '>
        <div className='CloudFetchError__header '>
            <FormattedMessage
                id='cloud.fetch_error'
                defaultMessage='Error fetching billing data. Please try again later.'
            />
        </div>
        <button
            className='btn btn-primary'
            onClick={() => {
                dispatch(retryFailedCloudFetches());
            }}
        >
            <FormattedMessage
                id='cloud.fetch_error.retry'
                defaultMessage='Retry'
            />
        </button>
    </div>);
}
