// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';

import loadingIcon from 'images/spinner-48x48-blue.apng';

export const SiteUrlStatuses = {
    Idle: 'Idle',
    Invalid: 'Invalid',
    Testing: 'Testing',
    Success: 'Success',
    Failed: 'Failed',
} as const;

export type SiteUrlStatusType = typeof SiteUrlStatuses[keyof typeof SiteUrlStatuses];

export const invalidSiteUrlMessage = defineMessage({
    id: 'onboarding_wizard.site_url.invalid',
    defaultMessage: 'Enter only http:// or https://, a host name, and an optional port, such as https://chat.example.com.',
});

const SiteUrlStatus = ({status}: {status: SiteUrlStatusType}) => {
    switch (status) {
    case SiteUrlStatuses.Invalid:
        return (
            <div className='SiteUrl__status SiteUrl__status--error'>
                <i className='icon icon-alert-outline'/>
                <FormattedMessage {...invalidSiteUrlMessage}/>
            </div>
        );
    case SiteUrlStatuses.Testing:
        return (
            <div className='SiteUrl__status'>
                <img
                    src={loadingIcon}
                    className='SiteUrl__status-spinner'
                />
                <FormattedMessage
                    id='onboarding_wizard.site_url.testing'
                    defaultMessage='Testing URL'
                />
            </div>
        );
    case SiteUrlStatuses.Success:
        return (
            <div className='SiteUrl__status SiteUrl__status--success'>
                <i className='icon icon-check'/>
                <FormattedMessage
                    id='onboarding_wizard.site_url.test_successful'
                    defaultMessage='Test successful. This is a valid URL.'
                />
            </div>
        );
    case SiteUrlStatuses.Failed:
        return (
            <div className='SiteUrl__status SiteUrl__status--error'>
                <i className='icon icon-alert-outline'/>
                <FormattedMessage
                    id='onboarding_wizard.site_url.test_unsuccessful'
                    defaultMessage='Test unsuccessful. This is not a valid URL.'
                />
            </div>
        );
    default:
        return null;
    }
};

export default SiteUrlStatus;
