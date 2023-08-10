// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {SelfHostedSignupProgress} from '@mattermost/types/hosted_customer';

import {HostedCustomerTypes} from 'mattermost-redux/action_types';
import {getLicenseConfig} from 'mattermost-redux/actions/general';
import {Client4} from 'mattermost-redux/client';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getSelfHostedSignupProgress} from 'mattermost-redux/selectors/entities/hosted_customer';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser, getFilteredUsersStats} from 'mattermost-redux/selectors/entities/users';

import {confirmSelfHostedExpansion} from 'actions/hosted_customer';
import {pageVisited} from 'actions/telemetry_actions';
import {closeModal} from 'actions/views/modals';
import {isCwsMockMode} from 'selectors/cloud';

import ChooseDifferentShipping from 'components/choose_different_shipping';
import useLoadStripe from 'components/common/hooks/useLoadStripe';
import BackgroundSvg from 'components/common/svg_images_components/background_svg';
import UpgradeSvg from 'components/common/svg_images_components/upgrade_svg';
import CardInput from 'components/payment_form/card_input';
import RootPortal from 'components/root_portal';
import Address from 'components/self_hosted_purchases/address';
import ContactSalesLink from 'components/self_hosted_purchases/contact_sales_link';
import ErrorPage from 'components/self_hosted_purchases/self_hosted_expansion_modal/error_page';
import SuccessPage from 'components/self_hosted_purchases/self_hosted_expansion_modal/success_page';
import Terms from 'components/self_hosted_purchases/self_hosted_purchase_modal/terms';
import Input from 'components/widgets/inputs/input/input';
import FullScreenModal from 'components/widgets/modals/full_screen_modal';

import {ModalIdentifiers, TELEMETRY_CATEGORIES} from 'utils/constants';
import {inferNames} from 'utils/hosted_customer';

import SelfHostedExpansionCard from './expansion_card';
import Submitting from './submitting';

import {STORAGE_KEY_EXPANSION_IN_PROGRESS} from '../constants';
import StripeProvider from '../stripe_provider';

import type {SelfHostedSignupCustomerResponse} from '@mattermost/types/hosted_customer';
import type {ValueOf} from '@mattermost/types/utilities';
import type {StripeCardElementChangeEvent} from '@stripe/stripe-js';
import type {CardInputType} from 'components/payment_form/card_input';
import type {DispatchFunc} from 'mattermost-redux/types/actions';

import './self_hosted_expansion_modal.scss';

export interface FormState {
    cardName: string;
    cardFilled: boolean;

    address: string;
    address2: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    organization: string;

    seats: number;

    shippingSame: boolean;
    shippingAddress: string;
    shippingAddress2: string;
    shippingCity: string;
    shippingState: string;
    shippingCountry: string;
    shippingPostalCode: string;

    agreedTerms: boolean;

    submitting: boolean;
    succeeded: boolean;
    progressBar: number;
    error: string;
}

export function makeInitialState(seats: number): FormState {
    return {
        cardName: '',
        cardFilled: false,
        address: '',
        address2: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
        organization: '',
        shippingSame: true,
        shippingAddress: '',
        shippingAddress2: '',
        shippingCity: '',
        shippingState: '',
        shippingCountry: '',
        shippingPostalCode: '',
        seats,
        agreedTerms: false,
        submitting: false,
        succeeded: false,
        progressBar: 0,
        error: '',
    };
}

export function canSubmit(formState: FormState, progress: ValueOf<typeof SelfHostedSignupProgress>) {
    if (formState.submitting) {
        return false;
    }

    const validAddress = Boolean(
        formState.organization &&
        formState.address &&
        formState.city &&
        formState.state &&
        formState.postalCode &&
        formState.country,
    );

    const validShippingAddress = Boolean(
        formState.shippingSame ||
        (formState.shippingAddress &&
        formState.shippingCity &&
        formState.shippingState &&
        formState.shippingPostalCode &&
        formState.shippingCountry),
    );

    const agreedToTerms = formState.agreedTerms;

    const validCard = Boolean(
        formState.cardName &&
        formState.cardFilled,
    );
    const validSeats = formState.seats > 0;

    switch (progress) {
    case SelfHostedSignupProgress.PAID:
    case SelfHostedSignupProgress.CREATED_LICENSE:
    case SelfHostedSignupProgress.CREATED_SUBSCRIPTION:
        return true;
    case SelfHostedSignupProgress.CONFIRMED_INTENT: {
        return Boolean(
            validAddress && validShippingAddress && validSeats && agreedToTerms,
        );
    }
    case SelfHostedSignupProgress.START:
    case SelfHostedSignupProgress.CREATED_CUSTOMER:
    case SelfHostedSignupProgress.CREATED_INTENT:
        return Boolean(
            validCard &&
                validAddress &&
                validShippingAddress &&
                validSeats &&
                agreedToTerms,
        );
    default: {
        return false;
    }
    }
}

export default function SelfHostedExpansionModal() {
    const dispatch = useDispatch<DispatchFunc>();
    const intl = useIntl();
    const cardRef = useRef<CardInputType | null>(null);
    const theme = useSelector(getTheme);
    const progress = useSelector(getSelfHostedSignupProgress);
    const user = useSelector(getCurrentUser);
    const cwsMockMode = useSelector(isCwsMockMode);

    const license = useSelector(getLicense);
    const licensedSeats = parseInt(license.Users, 10);
    const currentPlan = license.SkuName;
    const activeUsers = useSelector(getFilteredUsersStats)?.total_users_count || 0;
    const [minimumSeats] = useState(activeUsers <= licensedSeats ? 1 : activeUsers - licensedSeats);
    const [requestedSeats, setRequestedSeats] = useState(minimumSeats);

    const [stripeLoadHint, setStripeLoadHint] = useState(Math.random());
    const stripeRef = useLoadStripe(stripeLoadHint);

    const initialState = makeInitialState(requestedSeats);
    const [formState, setFormState] = useState<FormState>(initialState);
    const [show] = useState(true);
    const canRetry = formState.error !== '422';
    const showForm = progress !== SelfHostedSignupProgress.PAID && progress !== SelfHostedSignupProgress.CREATED_LICENSE && !formState.submitting && !formState.error && !formState.succeeded;

    const title = intl.formatMessage({
        id: 'self_hosted_expansion.expansion_modal.title',
        defaultMessage: 'Provide your payment details',
    });

    const canSubmitForm = canSubmit(formState, progress);

    const submit = async () => {
        let submitProgress = progress;
        let signupCustomerResult: SelfHostedSignupCustomerResponse | null = null;
        setFormState({...formState, submitting: true});
        try {
            const [firstName, lastName] = inferNames(user, formState.cardName);

            signupCustomerResult = await Client4.createCustomerSelfHostedSignup({
                first_name: firstName,
                last_name: lastName,
                billing_address: {
                    city: formState.city,
                    country: formState.country,
                    line1: formState.address,
                    line2: formState.address2,
                    postal_code: formState.postalCode,
                    state: formState.state,
                },
                shipping_address: {
                    city: formState.city,
                    country: formState.country,
                    line1: formState.address,
                    line2: formState.address2,
                    postal_code: formState.postalCode,
                    state: formState.state,
                },
                organization: formState.organization,
            });
        } catch {
            setFormState({...formState, error: 'Failed to submit payment information'});
            return;
        }

        if (signupCustomerResult === null) {
            setStripeLoadHint(Math.random());
            setFormState({...formState, submitting: false});
            return;
        }

        if (progress === SelfHostedSignupProgress.START || progress === SelfHostedSignupProgress.CREATED_CUSTOMER) {
            dispatch({
                type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_SIGNUP_PROGRESS,
                data: signupCustomerResult.progress,
            });
            submitProgress = signupCustomerResult.progress;
        }
        if (stripeRef.current === null) {
            setStripeLoadHint(Math.random());
            setFormState({...formState, submitting: false});
            return;
        }

        try {
            const card = cardRef.current?.getCard();
            if (!card) {
                const message = 'Failed to get card when it was expected';
                setFormState({...formState, error: message});
                return;
            }
            const finished = await dispatch(confirmSelfHostedExpansion(
                stripeRef.current,
                {
                    id: signupCustomerResult.setup_intent_id,
                    client_secret: signupCustomerResult.setup_intent_secret,
                },
                cwsMockMode,
                {
                    address: formState.address,
                    address2: formState.address2,
                    city: formState.city,
                    state: formState.state,
                    country: formState.country,
                    postalCode: formState.postalCode,
                    name: formState.cardName,
                    card,
                },
                submitProgress,
                {
                    seats: formState.seats,
                    license_id: license.Id,
                },
            ));

            if (finished.data) {
                setFormState({...formState, succeeded: true});

                dispatch({
                    type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_SIGNUP_PROGRESS,
                    data: SelfHostedSignupProgress.CREATED_LICENSE,
                });

                // Reload license in background.
                // Needed if this was completed while on the Edition and License page.
                dispatch(getLicenseConfig());
            } else if (finished.error) {
                let errorData = finished.error;
                if (finished.error === 422) {
                    errorData = finished.error.toString();
                }
                setFormState({...formState, error: errorData});
                return;
            }
            setFormState({...formState, submitting: false});
        } catch (e) {
            setFormState({...formState, error: 'unable to complete signup'});
        }
    };

    useEffect(() => {
        pageVisited(
            TELEMETRY_CATEGORIES.SELF_HOSTED_EXPANSION,
            'pageview_self_hosted_expansion',
        );

        localStorage.setItem(STORAGE_KEY_EXPANSION_IN_PROGRESS, 'true');
        return () => {
            localStorage.removeItem(STORAGE_KEY_EXPANSION_IN_PROGRESS);
        };
    }, []);

    const resetToken = () => {
        try {
            Client4.bootstrapSelfHostedSignup(true).
                then((data) => {
                    dispatch({
                        type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_SIGNUP_PROGRESS,
                        data: data.progress,
                    });
                });
        } catch {
            // swallow error ok here
        }
    };

    return (
        <StripeProvider
            stripeRef={stripeRef}
        >
            <RootPortal>
                <FullScreenModal
                    show={show}
                    ariaLabelledBy='self_hosted_expansion_modal_title'
                    onClose={() => {
                        dispatch(closeModal(ModalIdentifiers.SELF_HOSTED_EXPANSION));
                        resetToken();
                    }}
                >
                    <div className='SelfHostedExpansionModal'>
                        <div className={classNames('form-view', {'form-view--hide': !showForm})}>
                            <div className='lhs'>
                                <h2 className='title'>{title}</h2>
                                <UpgradeSvg
                                    width={267}
                                    height={227}
                                />
                                <div className='footer-text'>{'Questions?'}</div>
                                <ContactSalesLink/>
                            </div>
                            <div className='center'>
                                <div
                                    className='form'
                                    data-testid='expansion-modal'
                                >
                                    <span className='section-title'>
                                        {intl.formatMessage({
                                            id: 'payment_form.credit_card',
                                            defaultMessage: 'Credit Card',
                                        })}
                                    </span>
                                    <div className='form-row'>
                                        <CardInput
                                            forwardedRef={cardRef}
                                            required={true}
                                            onCardInputChange={(event: StripeCardElementChangeEvent) => {
                                                setFormState({...formState, cardFilled: event.complete});
                                            }}
                                            theme={theme}
                                        />
                                    </div>
                                    <div className='form-row'>
                                        <Input
                                            name='organization'
                                            type='text'
                                            value={formState.organization}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                setFormState({...formState, organization: e.target.value});
                                            }}
                                            placeholder={intl.formatMessage({
                                                id: 'self_hosted_signup.organization',
                                                defaultMessage: 'Organization Name',
                                            })}
                                            required={true}
                                        />
                                    </div>
                                    <div className='form-row'>
                                        <Input
                                            name='name'
                                            type='text'
                                            value={formState.cardName}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                setFormState({...formState, cardName: e.target.value});
                                            }}
                                            placeholder={intl.formatMessage({
                                                id: 'payment_form.name_on_card',
                                                defaultMessage: 'Name on Card',
                                            })}
                                            required={true}
                                        />
                                    </div>
                                    <span className='section-title'>
                                        <FormattedMessage
                                            id='payment_form.billing_address'
                                            defaultMessage='Billing address'
                                        />
                                    </span>
                                    <Address
                                        testPrefix='selfHostedExpansion'
                                        type='billing'
                                        country={formState.country}
                                        changeCountry={(option) => {
                                            setFormState({...formState, country: option.value});
                                        }}
                                        address={formState.address}
                                        changeAddress={(e) => {
                                            setFormState({...formState, address: e.target.value});
                                        }}
                                        address2={formState.address2}
                                        changeAddress2={(e) => {
                                            setFormState({...formState, address2: e.target.value});
                                        }}
                                        city={formState.city}
                                        changeCity={(e) => {
                                            setFormState({...formState, city: e.target.value});
                                        }}
                                        state={formState.state}
                                        changeState={(state: string) => {
                                            setFormState({...formState, state});
                                        }}
                                        postalCode={formState.postalCode}
                                        changePostalCode={(e) => {
                                            setFormState({...formState, postalCode: e.target.value});
                                        }}
                                    />
                                    <ChooseDifferentShipping
                                        shippingIsSame={formState.shippingSame}
                                        setShippingIsSame={(val: boolean) => {
                                            setFormState({...formState, shippingSame: val});
                                        }}
                                    />
                                    {!formState.shippingSame && (
                                        <>
                                            <div className='section-title'>
                                                <FormattedMessage
                                                    id='payment_form.shipping_address'
                                                    defaultMessage='Shipping Address'
                                                />
                                            </div>
                                            <Address
                                                testPrefix='shippingSelfHostedExpansion'
                                                type='shipping'
                                                country={formState.shippingCountry}
                                                changeCountry={(option) => {
                                                    setFormState({...formState, shippingCountry: option.value});
                                                }}
                                                address={formState.shippingAddress}
                                                changeAddress={(e) => {
                                                    setFormState({...formState, shippingAddress: e.target.value});
                                                }}
                                                address2={formState.shippingAddress2}
                                                changeAddress2={(e) => {
                                                    setFormState({...formState, shippingAddress2: e.target.value});
                                                }}
                                                city={formState.shippingCity}
                                                changeCity={(e) => {
                                                    setFormState({...formState, shippingCity: e.target.value});
                                                }}
                                                state={formState.shippingState}
                                                changeState={(state: string) => {
                                                    setFormState({...formState, shippingState: state});
                                                }}
                                                postalCode={formState.shippingPostalCode}
                                                changePostalCode={(e) => {
                                                    setFormState({...formState, shippingPostalCode: e.target.value});
                                                }}
                                            />
                                        </>
                                    )}
                                    <Terms
                                        agreed={formState.agreedTerms}
                                        setAgreed={(data: boolean) => {
                                            setFormState({...formState, agreedTerms: data});
                                        }}
                                    />
                                </div>
                            </div>
                            <div className='rhs'>
                                <SelfHostedExpansionCard
                                    updateSeats={(seats: number) => {
                                        setFormState({...formState, seats});
                                        setRequestedSeats(seats);
                                    }}
                                    canSubmit={canSubmitForm}
                                    submit={submit}
                                    licensedSeats={licensedSeats}
                                    minimumSeats={minimumSeats}
                                />
                            </div>
                        </div>
                        {((formState.succeeded || progress === SelfHostedSignupProgress.CREATED_LICENSE)) && !formState.error && !formState.submitting && (
                            <SuccessPage
                                onClose={() => {
                                    setFormState({...formState, submitting: false, error: '', succeeded: false});
                                    dispatch(closeModal(ModalIdentifiers.SELF_HOSTED_EXPANSION));
                                }}
                            />
                        )}
                        {formState.submitting && (
                            <Submitting
                                currentPlan={currentPlan}
                            />
                        )}
                        {formState.error && (
                            <ErrorPage
                                canRetry={canRetry}
                                tryAgain={() => {
                                    setFormState({...formState, submitting: false, error: ''});
                                }}
                            />
                        )}
                        <div className='background-svg'>
                            <BackgroundSvg/>
                        </div>
                    </div>
                </FullScreenModal>
            </RootPortal>
        </StripeProvider>
    );
}
