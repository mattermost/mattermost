// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Elements} from '@stripe/react-stripe-js';
import type {Stripe} from '@stripe/stripe-js';

import {STRIPE_CSS_SRC} from 'components/payment_form/stripe';

interface Props {
    children: React.ReactNode | React.ReactNodeArray;
    stripeRef: React.MutableRefObject<Stripe | null>;
}
export default function StripeElementsProvider(props: Props) {
    return (
        <Elements
            options={{fonts: [{cssSrc: STRIPE_CSS_SRC}]}}
            stripe={props.stripeRef.current}
        >
            {props.children}
        </Elements>
    );
}
