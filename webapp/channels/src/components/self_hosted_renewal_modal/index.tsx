// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useReducer, useState} from 'react';
import {useDispatch} from 'react-redux';

import {StripeCardElementChangeEvent} from '@stripe/stripe-js';

import {DispatchFunc} from 'mattermost-redux/types/actions';
import {Client4} from 'mattermost-redux/client';

import StripeProvider from 'components/self_hosted_purchase_modal/stripe_provider';
import useLoadStripe from 'components/common/hooks/useLoadStripe';
import CardInput, {CardInputType} from 'components/payment_form/card_input';

interface Props {}

export default function SelfHostedRenewalModal(props: Props) {
    const [stripeLoadHint, setStripeLoadHint] = useState(Math.random());

    const handleCardInputChange = (event: StripeCardElementChangeEvent) => {
    };
    const stripeRef = useLoadStripe(stripeLoadHint);
    const reduxDispatch = useDispatch<DispatchFunc>();
  async function renew() {
            const signupCustomerResult = await Client4.renewCustomerSelfHostedSignup({
                billing_address: {
                    city: 'state.city',
                    country: 'state.country',
                    line1: 'state.address',
                    line2: 'state.address2',
                    postal_code: 'state.postalCode',
                    state: 'state.state',
                },
                shipping_address: {
                    city: 'state.city',
                    country: 'state.country',
                    line1: 'state.address',
                    line2: 'state.address2',
                    postal_code: 'state.postalCode',
                    state: 'state.state',
                },
            });
    
await Client4.confirmSelfHostedRenewal()
  return (<StripeProvider
            stripeRef={stripeRef}
        >
                                        <CardInput
                                            forwardedRef={cardRef}
                                            required={true}
                                            onCardInputChange={handleCardInputChange}
                                            theme={theme}
                                        />
  <button onClick={renew}>'do it'</button >
  </StripeProvider>
)
}
