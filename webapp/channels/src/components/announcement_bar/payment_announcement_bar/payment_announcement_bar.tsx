// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {isEmpty} from 'lodash';

import {CloudCustomer, Subscription} from '@mattermost/types/cloud';

import {getHistory} from 'utils/browser_history';
import {isCustomerCardExpired} from 'utils/cloud_utils';
import {AnnouncementBarTypes} from 'utils/constants';
import {t} from 'utils/i18n';

import AnnouncementBar from '../default_announcement_bar';

type Props = {
    userIsAdmin: boolean;
    isCloud: boolean;
    subscription?: Subscription;
    customer?: CloudCustomer;
    isStarterFree: boolean;
    actions: {
        getCloudSubscription: () => void;
        getCloudCustomer: () => void;
    };
};

class PaymentAnnouncementBar extends React.PureComponent<Props> {
    async componentDidMount() {
        if (isEmpty(this.props.customer)) {
            await this.props.actions.getCloudCustomer();
        }
    }

    isMostRecentPaymentFailed = () => {
        return this.props.subscription?.last_invoice?.status === 'failed';
    }

    shouldShowBanner = () => {
        const {userIsAdmin, isCloud, subscription} = this.props;

        // Prevents banner flashes if the subscription hasn't been loaded yet
        if (subscription === null) {
            return false;
        }

        if (this.props.isStarterFree) {
            return false;
        }

        if (!isCloud) {
            return false;
        }

        if (!userIsAdmin) {
            return false;
        }

        if (!isCustomerCardExpired(this.props.customer) && !this.isMostRecentPaymentFailed()) {
            return false;
        }

        return true;
    }

    updatePaymentInfo = () => {
        getHistory().push('/admin_console/billing/payment_info');
    }

    render() {
        if (isEmpty(this.props.customer) || isEmpty(this.props.subscription)) {
            return null;
        }

        if (!this.shouldShowBanner()) {
            return null;
        }

        return (
            <AnnouncementBar
                type={AnnouncementBarTypes.CRITICAL}
                showCloseButton={false}
                onButtonClick={this.updatePaymentInfo}
                modalButtonText={t('admin.billing.subscription.updatePaymentInfo')}
                modalButtonDefaultText={'Update payment info'}
                message={this.isMostRecentPaymentFailed() ? t('admin.billing.subscription.mostRecentPaymentFailed') : t('admin.billing.subscription.creditCardExpired')}
                showLinkAsButton={true}
                isTallBanner={true}
            />

        );
    }
}

export default PaymentAnnouncementBar;
