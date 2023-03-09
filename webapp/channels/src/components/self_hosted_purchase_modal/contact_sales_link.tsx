// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {trackEvent} from 'actions/telemetry_actions';

import {getCloudContactUsLink, InquiryType} from 'selectors/cloud';
import {
    TELEMETRY_CATEGORIES,
} from 'utils/constants';

export default function ContactSalesLink() {
    const contactSupportLink = useSelector(getCloudContactUsLink)(InquiryType.Technical);
    const intl = useIntl();
    return (
        <a
            className='footer-text'
            onClick={() => {
                trackEvent(
                    TELEMETRY_CATEGORIES.SELF_HOSTED_PURCHASING,
                    'click_contact_sales',
                );
            }}
            href={contactSupportLink}
            target='_blank'
            rel='noopener noreferrer'
        >
            {intl.formatMessage({id: 'self_hosted_signup.contact_sales', defaultMessage: 'Contact Sales'})}
        </a>
    );
}
