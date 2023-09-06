// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import './choose_different_shipping.scss';

interface Props {
    shippingIsSame: boolean;
    setShippingIsSame: (different: boolean) => void;
}
export default function ChooseDifferentShipping(props: Props) {
    const intl = useIntl();
    const toggle = () => props.setShippingIsSame(!props.shippingIsSame);

    return (
        <div className='shipping-address-section'>
            <input
                id='address-same-than-billing-address'
                className='Form-checkbox-input'
                name='terms'
                type='checkbox'
                checked={props.shippingIsSame}
                onChange={toggle}
            />
            <span className='Form-checkbox-label'>
                <button
                    onClick={toggle}
                    type='button'
                    className='no-style'
                >
                    <span className='billing_address_btn_text'>
                        {intl.formatMessage({
                            id: 'admin.billing.subscription.complianceScreenShippingSameAsBilling',
                            defaultMessage:
                                'My shipping address is the same as my billing address',
                        })}
                    </span>
                </button>
            </span>
        </div>
    );
}
