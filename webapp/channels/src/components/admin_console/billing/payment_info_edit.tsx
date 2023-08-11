// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {Elements} from '@stripe/react-stripe-js';
import type {Stripe} from '@stripe/stripe-js';
import {loadStripe} from '@stripe/stripe-js/pure'; // https://github.com/stripe/stripe-js#importing-loadstripe-without-side-effects

import {getCloudCustomer} from 'mattermost-redux/actions/cloud';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {completeStripeAddPaymentMethod} from 'actions/cloud';
import {isCwsMockMode} from 'selectors/cloud';

import BlockableLink from 'components/admin_console/blockable_link';
import AlertBanner from 'components/alert_banner';
import ExternalLink from 'components/external_link';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import PaymentForm from 'components/payment_form/payment_form';
import {STRIPE_CSS_SRC, getStripePublicKey} from 'components/payment_form/stripe';
import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import {areBillingDetailsValid} from 'types/cloud/sku';
import type {BillingDetails} from 'types/cloud/sku';
import type {GlobalState} from 'types/store';
import {CloudLinks} from 'utils/constants';

import './payment_info_edit.scss';

let stripePromise: Promise<Stripe | null>;

const PaymentInfoEdit: React.FC = () => {
    const dispatch = useDispatch();
    const history = useHistory();

    const cwsMockMode = useSelector(isCwsMockMode);
    const paymentInfo = useSelector((state: GlobalState) => state.entities.cloud.customer);
    const theme = useSelector(getTheme);

    const [showCreditCardWarning, setShowCreditCardWarning] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isValid, setIsValid] = useState<boolean | undefined>(undefined);
    const [isServerError, setIsServerError] = useState(false);
    const [billingDetails, setBillingDetails] = useState<BillingDetails>({
        address: paymentInfo?.billing_address?.line1 || '',
        address2: paymentInfo?.billing_address?.line2 || '',
        city: paymentInfo?.billing_address?.city || '',
        state: paymentInfo?.billing_address?.state || '',
        country: paymentInfo?.billing_address?.country || '',
        postalCode: paymentInfo?.billing_address?.postal_code || '',
        name: '',
        card: {} as any,
    });

    const stripePublicKey = useSelector((state: GlobalState) => getStripePublicKey(state));

    useEffect(() => {
        dispatch(getCloudCustomer());
    }, []);

    const onPaymentInput = (billing: BillingDetails) => {
        setIsServerError(false);
        setIsValid(areBillingDetailsValid(billing));
        setBillingDetails(billing);
    };

    const handleSubmit = async () => {
        setIsSaving(true);
        const setPaymentMethod = completeStripeAddPaymentMethod((await stripePromise)!, billingDetails!, cwsMockMode);
        const success = await setPaymentMethod();

        if (success) {
            history.push('/admin_console/billing/payment_info');
        } else {
            setIsServerError(true);
        }

        setIsSaving(false);
    };

    if (!stripePromise) {
        stripePromise = loadStripe(stripePublicKey);
    }

    return (
        <div className='wrapper--fixed PaymentInfoEdit'>
            <AdminHeader withBackButton={true}>
                <div>
                    <BlockableLink
                        to='/admin_console/billing/payment_info'
                        className='fa fa-angle-left back'
                    />
                    <FormattedMessage
                        id='admin.billing.payment_info_edit.title'
                        defaultMessage='Edit Payment Information'
                    />
                </div>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    {showCreditCardWarning &&
                        <AlertBanner
                            mode='info'
                            title={
                                <FormattedMessage
                                    id='admin.billing.payment_info_edit.creditCardWarningTitle'
                                    defaultMessage='NOTE: Your card will not be charged at this time'
                                />
                            }
                            message={
                                <>
                                    <FormattedMarkdownMessage
                                        id='admin.billing.payment_info_edit.creditCardWarningDescription'
                                        defaultMessage='Your credit card will be charged based on the number of users you have at the end of the monthly billing cycle. '
                                    />
                                    <ExternalLink
                                        location='payment_info_edit'
                                        href={CloudLinks.BILLING_DOCS}
                                    >
                                        <FormattedMessage
                                            id='admin.billing.subscription.planDetails.howBillingWorks'
                                            defaultMessage='See how billing works'
                                        />
                                    </ExternalLink>
                                </>
                            }
                            onDismiss={() => setShowCreditCardWarning(false)}
                        />
                    }
                    <div className='PaymentInfoEdit__card'>
                        <Elements
                            options={{fonts: [{cssSrc: STRIPE_CSS_SRC}]}}
                            stripe={stripePromise}
                        >
                            <PaymentForm
                                className='PaymentInfoEdit__paymentForm'
                                onInputChange={onPaymentInput}
                                initialBillingDetails={billingDetails}
                                theme={theme}
                            />
                        </Elements>
                    </div>
                </div>
            </div>
            <div className='admin-console-save'>
                <SaveButton
                    saving={isSaving}
                    disabled={!billingDetails || !isValid}
                    onClick={handleSubmit}
                    defaultMessage={(
                        <FormattedMessage
                            id='admin.billing.payment_info_edit.save'
                            defaultMessage='Save credit card'
                        />
                    )}
                />
                <BlockableLink
                    className='cancel-button'
                    to='/admin_console/billing/payment_info'
                >
                    <FormattedMessage
                        id='admin.billing.payment_info_edit.cancel'
                        defaultMessage='Cancel'
                    />
                </BlockableLink>
                {isValid === false &&
                    <span className='PaymentInfoEdit__error'>
                        <i className='icon icon-alert-outline'/>
                        <FormattedMessage
                            id='admin.billing.payment_info_edit.formError'
                            defaultMessage='There are errors in the form above'
                        />
                    </span>
                }
                {isServerError &&
                    <span className='PaymentInfoEdit__error'>
                        <i className='icon icon-alert-outline'/>
                        <FormattedMessage
                            id='admin.billing.payment_info_edit.serverError'
                            defaultMessage='Something went wrong while saving payment infomation'
                        />
                    </span>
                }
            </div>
        </div>
    );
};

export default PaymentInfoEdit;
