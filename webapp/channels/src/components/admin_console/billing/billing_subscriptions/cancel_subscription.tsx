// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {trackEvent} from 'actions/telemetry_actions';

import {useOpenCloudZendeskSupportForm} from 'components/common/hooks/useOpenZendeskForm';
import ExternalLink from 'components/external_link';

const CancelSubscription = () => {
    const description = `I am requesting that workspace "${window.location.host}" be deleted`;
    const [, contactSupportURL] = useOpenCloudZendeskSupportForm('Request workspace be deleted', description);

    return (
        <div className='cancelSubscriptionSection'>
            <div className='cancelSubscriptionSection__text'>
                <div className='cancelSubscriptionSection__text-title'>
                    <FormattedMessage
                        id='admin.billing.subscription.cancelSubscriptionSection.title'
                        defaultMessage='Cancel your subscription'
                    />
                </div>
                <div className='cancelSubscriptionSection__text-description'>
                    <FormattedMessage
                        id='admin.billing.subscription.cancelSubscriptionSection.description'
                        defaultMessage='At this time, deleting a workspace can only be done with the help of a customer support representative.'
                    />
                </div>
                <ExternalLink
                    location='cancel_subscription'
                    href={contactSupportURL}
                    className='cancelSubscriptionSection__contactUs'
                    onClick={() => trackEvent('cloud_admin', 'click_contact_us')}
                >
                    <FormattedMessage
                        id='admin.billing.subscription.cancelSubscriptionSection.contactUs'
                        defaultMessage='Contact Us'
                    />
                </ExternalLink>
            </div>
        </div>
    );
};

export default CancelSubscription;
