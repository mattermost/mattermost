// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import BlockableLink from 'components/admin_console/blockable_link';
import type {ModeType} from 'components/alert_banner';
import AlertBanner from 'components/alert_banner';
import useGetSubscription from 'components/common/hooks/useGetSubscription';
import useOpenCloudPurchaseModal from 'components/common/hooks/useOpenCloudPurchaseModal';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';

import {daysToCancellation, daysToExpiration} from 'utils/cloud_utils';

export const creditCardExpiredBanner = (setShowCreditCardBanner: (value: boolean) => void) => {
    return (
        <AlertBanner
            mode='danger'
            title={
                <FormattedMessage
                    id='admin.billing.subscription.creditCardHasExpired'
                    defaultMessage='Your credit card has expired'
                />
            }
            message={
                <FormattedMessage
                    id='admin.billing.subscription.creditCardHasExpired.description'
                    defaultMessage='Please <link>update your payment information</link> to avoid any disruption.'
                    values={{
                        link: (text: string) => <BlockableLink to='/admin_console/billing/payment_info'>{text}</BlockableLink>,
                    }}
                />
            }
            onDismiss={() => setShowCreditCardBanner(false)}
        />
    );
};

export const paymentFailedBanner = () => {
    return (
        <AlertBanner
            mode='danger'
            title={
                <FormattedMessage
                    id='billing.subscription.info.mostRecentPaymentFailed'
                    defaultMessage='Your most recent payment failed'
                />
            }
            message={
                <FormattedMessage
                    id='billing.subscription.info.mostRecentPaymentFailed.description.mostRecentPaymentFailed'
                    defaultMessage='It looks your most recent payment failed because the credit card on your account has expired. Please <link>update your payment information</link> to avoid any disruption.'
                    values={{
                        link: (text: string) => <BlockableLink to='/admin_console/billing/payment_info'>{text}</BlockableLink>,
                    }}
                />
            }
        />
    );
};

export const CloudAnnualRenewalBanner = () => {
    const openPurchaseModal = useOpenCloudPurchaseModal({});
    const subscription = useGetSubscription();
    const {formatMessage} = useIntl();
    const [openSalesLink] = useOpenSalesLink();
    if (!subscription || !subscription.cancel_at || (subscription.will_renew === 'true' && !subscription.delinquent_since)) {
        return null;
    }
    const daysUntilExpiration = daysToExpiration(subscription);
    const daysUntilCancelation = daysToCancellation(subscription);
    const renewButton = (
        <button
            className='btn btn-primary'
            onClick={() => openPurchaseModal({})}
        >
            {formatMessage({id: 'cloud_annual_renewal.banner.buttonText.renew', defaultMessage: 'Renew'})}
        </button>
    );

    const contactSalesButton = (
        <button
            className='btn btn-tertiary'
            onClick={openSalesLink}
        >
            {formatMessage({id: 'cloud_annual_renewal.banner.buttonText.contactSales', defaultMessage: 'Contact Sales'})}
        </button>
    );

    const alertBannerProps = {
        mode: 'info' as ModeType,
        title: (<>{formatMessage({id: 'billing_subscriptions.cloud_annual_renewal_alert_banner_title', defaultMessage: 'Your annual subscription expires in {days} days. Please renew now to avoid any disruption'}, {days: daysUntilExpiration})}</>),
        actionButtonLeft: renewButton,
        actionButtonRight: contactSalesButton,
        message: <></>,
    };

    // If outside the 60 day window or on a trial, don't show this banner.
    if (daysUntilExpiration > 60 || subscription.is_free_trial === 'true') {
        return null;
    }

    if (daysUntilExpiration <= 7) {
        alertBannerProps.mode = 'danger';
    }

    if (daysUntilExpiration <= 0) {
        alertBannerProps.title = <>{formatMessage({id: 'billing_subscriptions.cloud_annual_renewal_alert_banner_title_expired', defaultMessage: 'Your subscription has expired. Your workspace will be deleted in {days} days. Please renew now to avoid any disruption'}, {days: daysUntilCancelation})}</>;
    }

    return (
        <AlertBanner
            id={'cloud_annual_renewal_alert_banner_' + alertBannerProps.mode}
            {...alertBannerProps}
        />

    );
};
