// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getCloudCustomer} from 'mattermost-redux/actions/cloud';
import {getCloudErrors} from 'mattermost-redux/selectors/entities/cloud';
import type {DispatchFunc} from 'mattermost-redux/types/actions';

import {pageVisited} from 'actions/telemetry_actions';

import AlertBanner from 'components/alert_banner';
import CloudFetchError from 'components/cloud_fetch_error';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import PaymentInfoDisplay from './payment_info_display';

import './payment_info.scss';

type Props = Record<string, never>;

const PaymentInfo: React.FC<Props> = () => {
    const dispatch = useDispatch<DispatchFunc>();
    const {customer: customerError} = useSelector(getCloudErrors);

    const isCardAboutToExpire = useSelector((state: GlobalState) => {
        const {customer} = state.entities.cloud;
        if (!customer) {
            return false;
        }

        const expiryYear = customer.payment_method.exp_year;

        // If not expiry year, or its 0, it's not expired (because it probably isn't set)
        if (!expiryYear) {
            return false;
        }

        // This works because we store the expiry month as the actual 1-12 base month, but Date uses a 0-11 base month
        // But credit cards expire at the end of their expiry month, so we can just use that number.
        const lastExpiryDate = new Date(expiryYear, customer.payment_method.exp_month, 1);
        const currentDatePlus10Days = new Date();
        currentDatePlus10Days.setDate(currentDatePlus10Days.getDate() + 10);
        return lastExpiryDate <= currentDatePlus10Days;
    });

    const [showCreditCardBanner, setShowCreditCardBanner] = useState(true);

    useEffect(() => {
        dispatch(getCloudCustomer());

        pageVisited('cloud_admin', 'pageview_billing_payment_info');
    }, []);

    return (
        <div className='wrapper--fixed PaymentInfo'>
            <AdminHeader>
                <FormattedMessage
                    id='admin.billing.payment_info.title'
                    defaultMessage='Payment Information'
                />
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    {showCreditCardBanner && isCardAboutToExpire && (
                        <AlertBanner
                            mode='info'
                            title={
                                <FormattedMessage
                                    id='admin.billing.payment_info.creditCardAboutToExpire'
                                    defaultMessage='Your credit card is about to expire'
                                />
                            }
                            message={
                                <FormattedMessage
                                    id='admin.billing.payment_info.creditCardAboutToExpire.description'
                                    defaultMessage='Please update your payment information to avoid any disruption.'
                                />
                            }
                            onDismiss={() => setShowCreditCardBanner(false)}
                        />
                    )}
                    {customerError ? <CloudFetchError/> : <PaymentInfoDisplay/>}
                </div>
            </div>
        </div>
    );
};

export default PaymentInfo;
