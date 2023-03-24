// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';

import {useIntl} from 'react-intl';

import {useDispatch, useSelector} from 'react-redux';

import {StripeCardElementChangeEvent} from '@stripe/stripe-js';

import UpgradeSvg from 'components/common/svg_images_components/upgrade_svg';
import RootPortal from 'components/root_portal';
import ContactSalesLink from 'components/self_hosted_purchase_modal/contact_sales_link';

import useLoadStripe from 'components/common/hooks/useLoadStripe';
import CardInput, {CardInputType} from 'components/payment_form/card_input';
import FullScreenModal from 'components/widgets/modals/full_screen_modal';
import Input from 'components/widgets/inputs/input/input';

import BackgroundSvg from 'components/common/svg_images_components/background_svg';
import {COUNTRIES} from 'utils/countries';
import StateSelector from 'components/payment_form/state_selector';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import DropdownInput from 'components/dropdown_input';
import StripeProvider from '../self_hosted_purchase_modal/stripe_provider';

import {closeModal} from 'actions/views/modals';
import {ModalIdentifiers, TELEMETRY_CATEGORIES} from 'utils/constants';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUser, getFilteredUsersStats} from 'mattermost-redux/selectors/entities/users';
import {pageVisited} from 'actions/telemetry_actions';

import {Client4} from 'mattermost-redux/client';
import {HostedCustomerTypes} from 'mattermost-redux/action_types';
import {getSelfHostedSignupProgress} from 'mattermost-redux/selectors/entities/hosted_customer';
import {inferNames} from 'utils/hosted_customer';
import {SelfHostedSignupCustomerResponse, SelfHostedSignupProgress} from '@mattermost/types/hosted_customer';
import {isDevModeEnabled} from 'selectors/general';
import {getLicenseConfig} from 'mattermost-redux/actions/general';
import {confirmSelfHostedExpansion} from 'actions/hosted_customer';
import {DispatchFunc} from 'mattermost-redux/types/actions';
import {ValueOf} from '@mattermost/types/utilities';

import SelfHostedExpansionCard from './expansion_card';

import './self_hosted_expansion_modal.scss';

import {STORAGE_KEY_EXPANSION_IN_PROGRESS} from './constants';

export interface FormState {
    address: string;
    address2: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    cardName: string;
    organization: string;
    cardFilled: boolean;
    seats: number;
    submitting: boolean;
    succeeded: boolean;
    progressBar: number;
    error: string;
}

export function makeInitialState(seats: number): FormState {
    return {
        address: '',
        address2: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
        cardName: '',
        organization: '',
        cardFilled: false,
        seats,
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
            validAddress &&
                validSeats,
        );
    }
    case SelfHostedSignupProgress.START:
    case SelfHostedSignupProgress.CREATED_CUSTOMER:
    case SelfHostedSignupProgress.CREATED_INTENT:
        return Boolean(
            validCard &&
                validAddress &&
                validSeats,
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
    const isDevMode = useSelector(isDevModeEnabled);

    const license = useSelector(getLicense);
    const licensedSeats = parseInt(license.Users, 10);
    const activeUsers = useSelector(getFilteredUsersStats)?.total_users_count || 0;
    const [additionalSeats, setAdditionalSeats] = useState(activeUsers <= licensedSeats ? 1 : activeUsers - licensedSeats);

    const [stripeLoadHint, setStripeLoadHint] = useState(Math.random());
    const stripeRef = useLoadStripe(stripeLoadHint);

    const initialState = makeInitialState(additionalSeats);
    const [formState, setFormState] = useState<FormState>(initialState);
    const [show] = useState(true);

    const title = intl.formatMessage({
        id: 'self_hosted_expansion.expansion_modal.title',
        defaultMessage: 'Provide your payment details',
    });

    const canSubmitForm = canSubmit(formState, progress);

    const submit = async () => {
        let submitProgress = progress;
        let signupCustomerResult: SelfHostedSignupCustomerResponse | null = null;
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
                // eslint-disable-next-line no-console
                console.error(message);
                setFormState({...formState, error: message});
                return;
            }
            const finished = await dispatch(confirmSelfHostedExpansion(
                stripeRef.current,
                {
                    id: signupCustomerResult.setup_intent_id,
                    client_secret: signupCustomerResult.setup_intent_secret,
                },
                isDevMode,
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
                    license_id: license.ID,
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
            // eslint-disable-next-line no-console
            console.error('could not complete setup', e);
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
                        <div className='form-view'>
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
                                    data-testid='shpm-form'
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
                                        {intl.formatMessage({
                                            id: 'payment_form.billing_address',
                                            defaultMessage: 'Billing address',
                                        })}
                                    </span>
                                    <DropdownInput
                                        testId='selfHostedExpansionCountrySelector'
                                        onChange={(option: {value: string}) => {
                                            setFormState({...formState, country: option.value});
                                        }}
                                        value={
                                            formState.country ? {value: formState.country, label: formState.country} : undefined
                                        }
                                        options={COUNTRIES.map((country) => ({
                                            value: country.name,
                                            label: country.name,
                                        }))}
                                        legend={intl.formatMessage({
                                            id: 'payment_form.country',
                                            defaultMessage: 'Country',
                                        })}
                                        placeholder={intl.formatMessage({
                                            id: 'payment_form.country',
                                            defaultMessage: 'Country',
                                        })}
                                        name={'billing_dropdown'}
                                    />
                                    <div className='form-row'>
                                        <Input
                                            name='address'
                                            type='text'
                                            value={formState.address}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                setFormState({...formState, address: e.target.value});
                                            }}
                                            placeholder={intl.formatMessage({
                                                id: 'payment_form.address',
                                                defaultMessage: 'Address',
                                            })}
                                            required={true}
                                        />
                                    </div>
                                    <div className='form-row'>
                                        <Input
                                            name='address2'
                                            type='text'
                                            value={formState.address2}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                setFormState({...formState, address2: e.target.value});
                                            }}
                                            placeholder={intl.formatMessage({
                                                id: 'payment_form.address_2',
                                                defaultMessage: 'Address 2',
                                            })}
                                        />
                                    </div>
                                    <div className='form-row'>
                                        <Input
                                            name='city'
                                            type='text'
                                            value={formState.city}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                setFormState({...formState, city: e.target.value});
                                            }}
                                            placeholder={intl.formatMessage({
                                                id: 'payment_form.city',
                                                defaultMessage: 'City',
                                            })}
                                            required={true}
                                        />
                                    </div>
                                    <div className='form-row'>
                                        <div className='form-row-third-1'>
                                            <StateSelector
                                                testId='selfHostedExpansionStateSelector'
                                                country={formState.country}
                                                state={formState.state}
                                                onChange={(state: string) => {
                                                    setFormState({...formState, state});
                                                }}
                                            />
                                        </div>
                                        <div className='form-row-third-2'>
                                            <Input
                                                name='postalCode'
                                                type='text'
                                                value={formState.postalCode}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    setFormState({...formState, postalCode: e.target.value});
                                                }}
                                                placeholder={intl.formatMessage({
                                                    id: 'payment_form.zipcode',
                                                    defaultMessage: 'Zip/Postal Code',
                                                })}
                                                required={true}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className='rhs'>
                                <SelfHostedExpansionCard
                                    updateSeats={(seats: number) => {
                                        setFormState({...formState, seats});
                                        setAdditionalSeats(seats);
                                    }}
                                    canSubmit={canSubmitForm}
                                    submit={submit}
                                    licensedSeats={licensedSeats}
                                    initialSeats={additionalSeats}
                                />
                            </div>
                        </div>
                        {/* {((formState.succeeded || progress === SelfHostedSignupProgress.CREATED_LICENSE) && hasLicense) && !formState.error && !formState.submitting && (
                            <SuccessPage
                                onClose={controlModal.close}
                                planName={desiredPlanName}
                            />
                        )}
                        {formState.submitting && (
                            <Submitting
                                desiredPlanName={desiredPlanName}
                                progressBar={formState.progressBar}
                            />
                        )}
                        {formState.error && (
                            <ErrorPage
                                nextAction={errorAction}
                                canRetry={canRetry}
                                errorType={canRetry ? 'generic' : 'failed_export'}
                            />
                        )} */}
                        <div className='background-svg'>
                            <BackgroundSvg/>
                        </div>
                    </div>
                </FullScreenModal>
            </RootPortal>
        </StripeProvider>
    );
}
