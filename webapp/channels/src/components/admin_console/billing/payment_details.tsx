// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import CardImage from 'components/payment_form/card_image';
import {GlobalState} from 'types/store';

export interface PaymentDetailsProps {
    children?: React.ReactNode;
}

const PaymentDetails: React.FC<PaymentDetailsProps> = ({children}: PaymentDetailsProps) => {
    const customerPaymentInfo = useSelector((state: GlobalState) => state.entities.cloud.customer);

    if (!customerPaymentInfo?.payment_method && !customerPaymentInfo?.billing_address) {
        return null;
    }
    const address = customerPaymentInfo.billing_address;

    return (
        <div className='PaymentInfoDisplay__paymentInfo-text'>
            <CardImage brand={customerPaymentInfo.payment_method.card_brand}/>
            <div className='PaymentInfoDisplay__paymentInfo-cardInfo'>
                <FormattedMarkdownMessage
                    id='admin.billing.payment_info.cardBrandAndDigits'
                    defaultMessage='{brand} ending in {digits}'
                    values={{
                        brand: customerPaymentInfo.payment_method.card_brand,
                        digits: customerPaymentInfo.payment_method.last_four,
                    }}
                />
                <br/>
                <FormattedMarkdownMessage
                    id='admin.billing.payment_info.cardExpiry'
                    defaultMessage='Expires {month}/{year}'
                    values={{
                        month: String(customerPaymentInfo.payment_method.exp_month).padStart(2, '0'),
                        year: String(customerPaymentInfo.payment_method.exp_year).padStart(2, '0'),
                    }}
                />
            </div>
            <div className='PaymentInfoDisplay__paymentInfo-addressTitle'>
                <FormattedMessage
                    id='admin.billing.payment_info.billingAddress'
                    defaultMessage='Billing Address'
                />
            </div>
            <div className='PaymentInfoDisplay__paymentInfo-address'>
                <div>{address.line1}</div>
                {address.line2 && <div>{address.line2}</div>}
                <div>{`${address.city}, ${address.state}, ${address.postal_code}`}</div>
                <div>{address.country}</div>
            </div>
            {children}
        </div>
    );
};

export default PaymentDetails;
