// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Stripe} from '@stripe/stripe-js';
import {getCode} from 'country-list';

import type {CreateSubscriptionRequest} from '@mattermost/types/cloud';
import type {SelfHostedExpansionRequest} from '@mattermost/types/hosted_customer';
import {SelfHostedSignupProgress} from '@mattermost/types/hosted_customer';
import type {ValueOf} from '@mattermost/types/utilities';

import {HostedCustomerTypes} from 'mattermost-redux/action_types';
import {bindClientFunc} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import {getSelfHostedErrors} from 'mattermost-redux/selectors/entities/hosted_customer';
import type {ActionFunc, DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';

import {getConfirmCardSetup} from 'components/payment_form/stripe';

import type {StripeSetupIntent, BillingDetails} from 'types/cloud/sku';

function selfHostedNeedsConfirmation(progress: ValueOf<typeof SelfHostedSignupProgress>): boolean {
    switch (progress) {
    case SelfHostedSignupProgress.START:
    case SelfHostedSignupProgress.CREATED_CUSTOMER:
    case SelfHostedSignupProgress.CREATED_INTENT:
        return true;
    default:
        return false;
    }
}

const STRIPE_UNEXPECTED_STATE = 'setup_intent_unexpected_state';
const STRIPE_ALREADY_SUCCEEDED = 'You cannot update this SetupIntent because it has already succeeded.';

export function confirmSelfHostedSignup(
    stripe: Stripe,
    stripeSetupIntent: StripeSetupIntent,
    cwsMockMode: boolean,
    billingDetails: BillingDetails,
    initialProgress: ValueOf<typeof SelfHostedSignupProgress>,
    subscriptionRequest: CreateSubscriptionRequest,
): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        const cardSetupFunction = getConfirmCardSetup(cwsMockMode);
        const confirmCardSetup = cardSetupFunction(stripe.confirmCardSetup);

        const shouldConfirmCard = selfHostedNeedsConfirmation(initialProgress);
        if (shouldConfirmCard) {
            const result = await confirmCardSetup(
                stripeSetupIntent.client_secret,
                {
                    payment_method: {
                        card: billingDetails.card,
                        billing_details: {
                            name: billingDetails.name,
                            address: {
                                line1: billingDetails.address,
                                line2: billingDetails.address2,
                                city: billingDetails.city,
                                state: billingDetails.state,
                                country: getCode(billingDetails.country),
                                postal_code: billingDetails.postalCode,
                            },
                        },
                    },
                },
            );
            if (!result) {
                return {data: false, error: 'failed to confirm card with Stripe'};
            }

            const {setupIntent, error: stripeError} = result;

            if (stripeError) {
                if (stripeError.code === STRIPE_UNEXPECTED_STATE && stripeError.message === STRIPE_ALREADY_SUCCEEDED && stripeError.setup_intent?.status === 'succeeded') {
                    dispatch({
                        type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_SIGNUP_PROGRESS,
                        data: SelfHostedSignupProgress.CONFIRMED_INTENT,
                    });
                } else {
                    return {data: false, error: stripeError.message || 'Stripe failed to confirm payment method'};
                }
            } else {
                if (setupIntent === null || setupIntent === undefined) {
                    return {data: false, error: 'Stripe did not return successful setup intent'};
                }

                if (setupIntent.status !== 'succeeded') {
                    return {data: false, error: `Stripe setup intent status was: ${setupIntent.status}`};
                }
                dispatch({
                    type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_SIGNUP_PROGRESS,
                    data: SelfHostedSignupProgress.CONFIRMED_INTENT,
                });
            }
        }

        let confirmResult;
        try {
            confirmResult = await Client4.confirmSelfHostedSignup(stripeSetupIntent.id, subscriptionRequest);
            dispatch({
                type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_SIGNUP_PROGRESS,
                data: confirmResult.progress,
            });
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);

            // unprocessable entity, e.g. failed export compliance
            if (error.status_code === 422) {
                return {data: false, error: error.status_code};
            }
            return {data: false, error};
        }

        return {data: confirmResult.license};
    };
}

export function getSelfHostedProducts(): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        try {
            dispatch({
                type: HostedCustomerTypes.SELF_HOSTED_PRODUCTS_REQUEST,
            });
            const result = await Client4.getSelfHostedProducts();
            if (result) {
                dispatch({
                    type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_PRODUCTS,
                    data: result,
                });
            }
        } catch (error) {
            dispatch({
                type: HostedCustomerTypes.SELF_HOSTED_PRODUCTS_FAILED,
            });
            return error;
        }
        return true;
    };
}

export function getSelfHostedInvoices(): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        try {
            dispatch({
                type: HostedCustomerTypes.SELF_HOSTED_INVOICES_REQUEST,
            });
            const result = await Client4.getSelfHostedInvoices();
            if (result) {
                dispatch({
                    type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_INVOICES,
                    data: result,
                });
            }
        } catch (error) {
            dispatch({
                type: HostedCustomerTypes.SELF_HOSTED_INVOICES_FAILED,
            });
            return error;
        }
        return true;
    };
}
export function retryFailedHostedCustomerFetches() {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const errors = getSelfHostedErrors(getState());
        if (Object.keys(errors).length === 0) {
            return {data: true};
        }

        if (errors.products) {
            dispatch(getSelfHostedProducts());
        }

        if (errors.invoices) {
            dispatch(getSelfHostedInvoices());
        }

        return {data: true};
    };
}

export function submitTrueUpReview(): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.submitTrueUpReview,
        onSuccess: [HostedCustomerTypes.RECEIVED_TRUE_UP_REVIEW_BUNDLE],
        onFailure: HostedCustomerTypes.TRUE_UP_REVIEW_PROFILE_FAILED,
        onRequest: HostedCustomerTypes.TRUE_UP_REVIEW_PROFILE_REQUEST,
    });
}

export function getTrueUpReviewStatus(): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getTrueUpReviewStatus,
        onSuccess: [HostedCustomerTypes.RECEIVED_TRUE_UP_REVIEW_STATUS],
        onFailure: HostedCustomerTypes.TRUE_UP_REVIEW_STATUS_FAILED,
        onRequest: HostedCustomerTypes.TRUE_UP_REVIEW_STATUS_REQUEST,
    });
}

export function confirmSelfHostedExpansion(
    stripe: Stripe,
    stripeSetupIntent: StripeSetupIntent,
    cwsMockMode: boolean,
    billingDetails: BillingDetails,
    initialProgress: ValueOf<typeof SelfHostedSignupProgress>,
    expansionRequest: SelfHostedExpansionRequest,
): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        const cardSetupFunction = getConfirmCardSetup(cwsMockMode);
        const confirmCardSetup = cardSetupFunction(stripe.confirmCardSetup);

        const shouldConfirmCard = selfHostedNeedsConfirmation(initialProgress);
        if (shouldConfirmCard) {
            const result = await confirmCardSetup(
                stripeSetupIntent.client_secret,
                {
                    payment_method: {
                        card: billingDetails.card,
                        billing_details: {
                            name: billingDetails.name,
                            address: {
                                line1: billingDetails.address,
                                line2: billingDetails.address2,
                                city: billingDetails.city,
                                state: billingDetails.state,
                                country: getCode(billingDetails.country),
                                postal_code: billingDetails.postalCode,
                            },
                        },
                    },
                },
            );

            if (!result) {
                return {data: false, error: 'failed to confirm card with Stripe'};
            }

            const {setupIntent, error: stripeError} = result;

            if (stripeError) {
                if (stripeError.code === STRIPE_UNEXPECTED_STATE && stripeError.message === STRIPE_ALREADY_SUCCEEDED && stripeError.setup_intent?.status === 'succeeded') {
                    dispatch({
                        type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_SIGNUP_PROGRESS,
                        data: SelfHostedSignupProgress.CONFIRMED_INTENT,
                    });
                } else {
                    return {data: false, error: stripeError.message || 'Stripe failed to confirm payment method'};
                }
            } else {
                if (setupIntent === null || setupIntent === undefined) {
                    return {data: false, error: 'Stripe did not return successful setup intent'};
                }

                if (setupIntent.status !== 'succeeded') {
                    return {data: false, error: `Stripe setup intent status was: ${setupIntent.status}`};
                }
                dispatch({
                    type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_SIGNUP_PROGRESS,
                    data: SelfHostedSignupProgress.CONFIRMED_INTENT,
                });
            }
        }

        let confirmResult;
        try {
            confirmResult = await Client4.confirmSelfHostedExpansion(stripeSetupIntent.id, expansionRequest);
            dispatch({
                type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_SIGNUP_PROGRESS,
                data: confirmResult.progress,
            });
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);

            // unprocessable entity, e.g. failed export compliance
            if (error.status_code === 422) {
                return {data: false, error: error.status_code};
            }
            return {data: false, error};
        }

        return {data: confirmResult.license};
    };
}
