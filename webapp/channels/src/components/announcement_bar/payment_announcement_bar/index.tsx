// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import isEmpty from 'lodash/isEmpty';
import React, {useEffect, useState} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {getCloudCustomer} from 'mattermost-redux/actions/cloud';
import {
    getCloudSubscription as selectCloudSubscription,
    getCloudCustomer as selectCloudCustomer,
    getSubscriptionProduct,
} from 'mattermost-redux/selectors/entities/cloud';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {getHistory} from 'utils/browser_history';
import {isCustomerCardExpired} from 'utils/cloud_utils';
import {AnnouncementBarTypes, CloudProducts, ConsolePages} from 'utils/constants';

import AnnouncementBar from '../default_announcement_bar';

export default function PaymentAnnouncementBar() {
    const [requestedCustomer, setRequestedCustomer] = useState(false);
    const dispatch = useDispatch();
    const subscription = useSelector(selectCloudSubscription);
    const customer = useSelector(selectCloudCustomer);
    const isStarterFree = useSelector(getSubscriptionProduct)?.sku === CloudProducts.STARTER;
    const userIsAdmin = useSelector(isCurrentUserSystemAdmin);
    const isCloud = useSelector(getLicense).Cloud === 'true';

    useEffect(() => {
        if (isCloud && !isStarterFree && isEmpty(customer) && userIsAdmin && !requestedCustomer) {
            setRequestedCustomer(true);
            dispatch(getCloudCustomer());
        }
    },
    [isCloud, isStarterFree, customer, userIsAdmin, requestedCustomer]);

    const mostRecentPaymentFailed = subscription?.last_invoice?.status === 'failed';

    if (
        // Prevents banner flashes if the subscription hasn't been loaded yet
        isEmpty(subscription) ||
        isStarterFree ||
        !isCloud ||
        !userIsAdmin ||
        isEmpty(customer) ||
        (!isCustomerCardExpired(customer) && !mostRecentPaymentFailed)
    ) {
        return null;
    }

    const updatePaymentInfo = () => {
        getHistory().push(ConsolePages.PAYMENT_INFO);
    };

    let message = (
        <FormattedMessage
            id='admin.billing.subscription.creditCardExpired'
            defaultMessage='Your credit card has expired. Update your payment information to avoid disruption.'
        />
    );

    if (mostRecentPaymentFailed) {
        message = (
            <FormattedMessage
                id='admin.billing.subscription.mostRecentPaymentFailed'
                defaultMessage='Your most recent payment failed'
            />
        );
    }

    return (
        <AnnouncementBar
            type={AnnouncementBarTypes.CRITICAL}
            showCloseButton={false}
            onButtonClick={updatePaymentInfo}
            modalButtonText={messages.updatePaymentInfo}
            message={message}
            showLinkAsButton={true}
            isTallBanner={true}
        />
    );
}

const messages = defineMessages({
    updatePaymentInfo: {
        id: 'admin.billing.subscription.updatePaymentInfo',
        defaultMessage: 'Update payment info',
    },
});
