// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useRef, useState} from 'react';
import {useSelector} from 'react-redux';

import type {Stripe} from '@stripe/stripe-js';
import {loadStripe} from '@stripe/stripe-js/pure'; // https://github.com/stripe/stripe-js#importing-loadstripe-without-side-effects

import {getStripePublicKey} from 'components/payment_form/stripe';

import type {GlobalState} from 'types/store';

// reloadHint
export default function useLoadStripe(reloadHint?: number) {
    const stripeRef = useRef<Stripe | null>(null);
    const [, setDone] = useState(false);
    const stripePublicKey = useSelector((state: GlobalState) => getStripePublicKey(state));

    useEffect(() => {
        if (stripeRef.current) {
            return;
        }
        loadStripe(stripePublicKey).then((stripe: Stripe | null) => {
            stripeRef.current = stripe;

            // deliberately cause a rerender so that the input can render.
            // otherwise, the input does not show up.
            setDone(true);
        });
    }, [reloadHint]);
    return stripeRef;
}

