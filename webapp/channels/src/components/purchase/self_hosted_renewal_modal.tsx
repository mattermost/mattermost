// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useReducer, useState} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {FormattedMessage, useIntl} from 'react-intl';

import classNames from 'classnames';
import {StripeCardElementChangeEvent} from '@stripe/stripe-js';

import {ValueOf} from '@mattermost/types/utilities';
import {Address} from '@mattermost/types/cloud';
import {SelfHostedRenewalProgress} from '@mattermost/types/hosted_customer';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getAdminAnalytics} from 'mattermost-redux/selectors/entities/admin';
import {getSelfHostedRenewalProgress} from 'mattermost-redux/selectors/entities/hosted_customer';
import {Client4} from 'mattermost-redux/client';
import {HostedCustomerTypes} from 'mattermost-redux/action_types';
import {getLicenseConfig} from 'mattermost-redux/actions/general';
import {DispatchFunc} from 'mattermost-redux/types/actions';

import {trackEvent, pageVisited} from 'actions/telemetry_actions';
import {confirmSelfHostedRenewal} from 'actions/hosted_customer';

import {GlobalState} from 'types/store';
import {isAddressValid} from 'types/cloud/sku';

import {isModalOpen} from 'selectors/views/modals';
import {isDevModeEnabled} from 'selectors/general';

import {
    ModalIdentifiers,
    StatTypes,
    TELEMETRY_CATEGORIES,
} from 'utils/constants';

import CardInput, {CardInputType} from 'components/payment_form/card_input';
import BackgroundSvg from 'components/common/svg_images_components/background_svg';
import UpgradeSvg from 'components/common/svg_images_components/upgrade_svg';
import Input from 'components/widgets/inputs/input/input';
import FullScreenModal from 'components/widgets/modals/full_screen_modal';
import RootPortal from 'components/root_portal';
import useLoadStripe from 'components/common/hooks/useLoadStripe';
import useGetSelfHostedProducts from 'components/common/hooks/useGetSelfHostedProducts';
import useControlSelfHostedRenewalModal from 'components/common/hooks/useControlSelfHostedRenewalModal';
import useFetchStandardAnalytics from 'components/common/hooks/useFetchStandardAnalytics';
import ChooseDifferentShipping from 'components/choose_different_shipping';
import StripeProvider from 'components/stripe_provider';

import {MIN_PURCHASE_SEATS, validateSeats, Seats, errorInvalidNumber} from '../seats_calculator';

import ContactSalesLink from './contact_sales_link';
import Submitting, {convertRenewalProgressToBar} from './submitting';
import ErrorPage from './error';
import SuccessPage from './success_page';
import SelfHostedCard from './self_hosted_card';
import Terms from './terms';
import AddressComponent, {useAddressReducer} from './address';
import useNoEscape from './useNoEscape';

import {SetPrefix, UnionSetActions} from './types';

import './self_hosted_purchase_modal.scss';

import {STORAGE_KEY_RENEWAL_IN_PROGRESS} from './constants';

export interface State {
    shippingSame: boolean;
    cardName: string;
    organization: string;
    agreedTerms: boolean;
    cardFilled: boolean;
    seats: Seats;
    submitting: boolean;
    succeeded: boolean;
    progressBar: number;
    error: string;
}

interface UpdateSucceeded {
    type: 'succeeded';
}

interface UpdateProgressBarFake {
    type: 'update_progress_bar_fake';
}

interface ClearError {
    type: 'clear_error';
}

type SetActions = UnionSetActions<State>;

type Action = SetActions | UpdateProgressBarFake | UpdateSucceeded | ClearError
export function makeInitialState(): State {
    return {
        shippingSame: true,

        cardName: '',
        organization: '',
        agreedTerms: false,
        cardFilled: false,
        seats: {
            quantity: '0',
            error: errorInvalidNumber,
        },
        submitting: false,
        succeeded: false,
        progressBar: 0,
        error: '',
    };
}
const initialState = makeInitialState();

const maxFakeProgress = 90;
const maxFakeProgressIncrement = 5;
const fakeProgressInterval = 1500;

function getPlanNameFromProductName(productName: string): string {
    if (productName.length > 0) {
        const [name] = productName.split(' ').slice(-1);
        return name;
    }

    return productName;
}

function isSetAction(action: Action): action is SetActions {
    return Object.prototype.hasOwnProperty.call(action, 'data');
}

type SetKey=`${typeof SetPrefix}${Extract<keyof State, string>}`;

function actionTypeToStateKey(actionType: SetKey): Extract<keyof State, string> {
    return actionType.slice(SetPrefix.length) as Extract<keyof State, string>;
}

function simpleSet(keys: Array<Extract<keyof State, string>>, state: State, action: Action): [State, boolean] {
    if (!isSetAction(action)) {
        return [state, false];
    }
    const stateKey = actionTypeToStateKey(action.type);
    if (!keys.includes(stateKey)) {
        return [state, false];
    }

    return [{...state, [stateKey]: action.data}, true];
}

// properties we can set the field on directly without needing to consider or modify other properties
const simpleSetters: Array<Extract<keyof State, string>> = [
    'shippingSame',
    'agreedTerms',
    'cardFilled',
    'cardName',
    'organization',
    'progressBar',
    'seats',
    'submitting',
];
function reducer(state: State, action: Action): State {
    const [newState, handled] = simpleSet(simpleSetters, state, action);
    if (handled) {
        return newState;
    }
    switch (action.type) {
    case 'update_progress_bar_fake': {
        const firstLongStep = SelfHostedRenewalProgress.CONFIRMED_INTENT;
        if (state.progressBar >= convertRenewalProgressToBar(firstLongStep) && state.progressBar <= maxFakeProgress - maxFakeProgressIncrement) {
            return {...state, progressBar: state.progressBar + maxFakeProgressIncrement};
        }
        return state;
    }
    case 'clear_error': {
        return {
            ...state,
            error: '',
        };
    }
    case 'set_error': {
        return {
            ...state,
            submitting: false,
            error: action.data,
        };
    }
    case 'succeeded':
        return {...state, submitting: false, succeeded: true};
    default:
        // eslint-disable-next-line no-console
        console.error(`Exhaustiveness failure for self hosted purchase modal. action: ${JSON.stringify(action)}`);
        return state;
    }
}

export function canSubmit(state: State, billingAddress: Address, shippingAddress: Address, progress: ValueOf<typeof SelfHostedRenewalProgress>) {
    if (state.submitting) {
        return false;
    }

    let validAddress = state.organization && isAddressValid(billingAddress);
    if (!state.shippingSame) {
        validAddress = validAddress && isAddressValid(shippingAddress);
    }
    const validCard = Boolean(
        state.cardName &&
        state.cardFilled,
    );
    const validSeats = !state.seats.error;
    switch (progress) {
    case SelfHostedRenewalProgress.PAID:
    case SelfHostedRenewalProgress.CREATED_LICENSE:
    case SelfHostedRenewalProgress.CREATED_SUBSCRIPTION:
        return true;
    case SelfHostedRenewalProgress.CONFIRMED_INTENT: {
        return Boolean(
            validAddress &&
            validSeats &&
            state.agreedTerms,
        );
    }
    case SelfHostedRenewalProgress.START:
    case SelfHostedRenewalProgress.CREATED_CUSTOMER:
    case SelfHostedRenewalProgress.CREATED_INTENT:
        return Boolean(
            validCard &&
            validAddress &&
            validSeats &&
            state.agreedTerms,
        );
    default: {
    // eslint-disable-next-line no-console
        console.log(`Unexpected progress state: ${progress}`);
        return false;
    }
    }
}

interface Props {
    productId: string;
}

interface FakeProgress {
    intervalId?: NodeJS.Timeout;
}

export default function SelfHostedPurchaseModal(props: Props) {
    useFetchStandardAnalytics();
    useNoEscape();
    const controlModal = useControlSelfHostedRenewalModal({});
    const show = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.SELF_HOSTED_RENEWAL));
    const progress = useSelector(getSelfHostedRenewalProgress);
    const theme = useSelector(getTheme);
    const analytics = useSelector(getAdminAnalytics) || {};
    const [products, productsLoaded] = useGetSelfHostedProducts();
    const desiredProduct = products[props.productId];
    const desiredProductName = desiredProduct?.name || '';
    const desiredPlanName = getPlanNameFromProductName(desiredProductName);
    const currentUsers = analytics[StatTypes.TOTAL_USERS] as number;
    const isDevMode = useSelector(isDevModeEnabled);
    const license = useSelector(getLicense);
    const hasLicense = Object.keys(license || {}).length > 0;
    const currentProductSku = license.SkuName || '';

    const intl = useIntl();
    const fakeProgressRef = useRef<FakeProgress>({
    });

    const [state, dispatch] = useReducer(reducer, initialState);
    const shippingAddressReducer = useAddressReducer();
    const billingAddressReducer = useAddressReducer();
    const reduxDispatch = useDispatch<DispatchFunc>();

    const cardRef = useRef<CardInputType | null>(null);
    const modalRef = useRef();
    const [stripeLoadHint, setStripeLoadHint] = useState(Math.random());

    const stripeRef = useLoadStripe(stripeLoadHint);
    const showForm = progress !== SelfHostedRenewalProgress.PAID && progress !== SelfHostedRenewalProgress.CREATED_LICENSE && !state.submitting && !state.error && !state.succeeded;

    useEffect(() => {
        if (!desiredProduct?.price_per_seat) {
            return;
        }
        if (typeof currentUsers === 'number' && (currentUsers > parseInt(state.seats.quantity, 10) || !parseInt(state.seats.quantity, 10))) {
            dispatch({type: 'set_seats',
                data: validateSeats(Math.max(currentUsers, MIN_PURCHASE_SEATS).toString(), desiredProduct.price_per_seat * 12, currentUsers, false),
            });
        }
    }, [currentUsers, desiredProduct?.price_per_seat]);
    useEffect(() => {
        pageVisited(
            TELEMETRY_CATEGORIES.SELF_HOSTED_RENEWAL,
            'pageview_self_hosted_purchase',
        );

        localStorage.setItem(STORAGE_KEY_RENEWAL_IN_PROGRESS, 'true');
        return () => {
            localStorage.removeItem(STORAGE_KEY_RENEWAL_IN_PROGRESS);
        };
    }, []);

    useEffect(() => {
        const progressBar = convertRenewalProgressToBar(progress);
        if (progressBar > state.progressBar) {
            dispatch({type: 'set_progressBar', data: progressBar});
        }
    }, [progress]);

    useEffect(() => {
        if (fakeProgressRef.current && fakeProgressRef.current.intervalId) {
            clearInterval(fakeProgressRef.current.intervalId);
        }
        if (state.submitting) {
            fakeProgressRef.current.intervalId = setInterval(() => {
                dispatch({type: 'update_progress_bar_fake'});
            }, fakeProgressInterval);
        }
        return () => {
            if (fakeProgressRef.current && fakeProgressRef.current.intervalId) {
                clearInterval(fakeProgressRef.current.intervalId);
            }
        };
    }, [state.submitting]);

    const handleCardInputChange = (event: StripeCardElementChangeEvent) => {
        dispatch({type: 'set_cardFilled', data: event.complete});
    };

    if (!productsLoaded) {
        return null;
    }

    async function submit() {
        let submitProgress = progress;
        dispatch({type: 'set_submitting', data: true});
        let renewCustomerResult;
        try {
            renewCustomerResult = await Client4.renewCustomerSelfHostedSignup({
                billing_address: billingAddressReducer.address,
                shipping_address: state.shippingSame ? billingAddressReducer.address : shippingAddressReducer.address,
            });
        } catch {
            dispatch({type: 'set_error', data: 'Failed to submit payment information'});
            return;
        }
        if (!renewCustomerResult || !renewCustomerResult.progress) {
            dispatch({type: 'set_error', data: 'Failed to submit payment information'});
            return;
        }

        if (progress === SelfHostedRenewalProgress.START || progress === SelfHostedRenewalProgress.CREATED_CUSTOMER) {
            reduxDispatch({
                type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_RENEWAL_PROGRESS,
                data: renewCustomerResult.progress,
            });
            submitProgress = renewCustomerResult.progress;
        }
        if (stripeRef.current === null) {
            setStripeLoadHint(Math.random());
            dispatch({type: 'set_submitting', data: false});
            return;
        }
        try {
            const card = cardRef.current?.getCard();
            if (!card) {
                const message = 'Failed to get card when it was expected';
                // eslint-disable-next-line no-console
                console.error(message);
                dispatch({type: 'set_error', data: message});
                return;
            }
            const finished = await reduxDispatch(confirmSelfHostedRenewal(
                stripeRef.current!,
                {
                    id: renewCustomerResult.setup_intent_id,
                    client_secret: renewCustomerResult.setup_intent_secret,
                },
                isDevMode,
                billingAddressReducer.address,
                state.cardName,
                card!,
                submitProgress,
            ));
            if (finished.data) {
                trackEvent(
                    TELEMETRY_CATEGORIES.SELF_HOSTED_RENEWAL,
                    'purchase_success',
                    {seats: parseInt(finished.data?.Users, 10) || 0, users: currentUsers},
                );
                dispatch({type: 'succeeded'});

                reduxDispatch({
                    type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_RENEWAL_PROGRESS,
                    data: SelfHostedRenewalProgress.CREATED_LICENSE,
                });

                // Reload license in background.
                // Needed if this was completed while on the Edition and License page.
                reduxDispatch(getLicenseConfig());
            } else if (finished.error) {
                let errorData = finished.error;
                if (finished.error === 422) {
                    errorData = finished.error.toString();
                }
                dispatch({type: 'set_error', data: errorData});
                return;
            }
            dispatch({type: 'set_submitting', data: false});
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('could not complete setup', e);
            dispatch({type: 'set_error', data: 'unable to complete signup'});
        }
    }
    const canSubmitForm = canSubmit(state, billingAddressReducer.address, shippingAddressReducer.address, progress);

    const title = (
        <FormattedMessage
            defaultMessage={'Provide your payment details'}
            id={'admin.billing.subscription.providePaymentDetails'}
        />
    );

    const canRetry = state.error !== '422';
    const resetToken = () => {
        try {
            Client4.bootstrapSelfHostedSignup(true).
                then((data) => {
                    reduxDispatch({
                        type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_RENEWAL_PROGRESS,
                        data: data.progress,
                    });
                });
        } catch {
            // swallow error ok here
        }
    };
    const errorAction = () => {
        if (canRetry && (progress === SelfHostedRenewalProgress.CREATED_SUBSCRIPTION || progress === SelfHostedRenewalProgress.PAID || progress === SelfHostedRenewalProgress.CREATED_LICENSE)) {
            submit();
            dispatch({type: 'clear_error'});
            return;
        }

        resetToken();
        if (canRetry) {
            dispatch({type: 'set_error', data: ''});
        } else {
            controlModal.close();
        }
    };

    return (
        <StripeProvider
            stripeRef={stripeRef}
        >
            <RootPortal>
                <FullScreenModal
                    show={show}
                    ref={modalRef}
                    ariaLabelledBy='self_hosted_purchase_modal_title'
                    onClose={() => {
                        trackEvent(
                            TELEMETRY_CATEGORIES.SELF_HOSTED_RENEWAL,
                            'click_close_purchasing_screen',
                        );
                        resetToken();
                        controlModal.close();
                    }}
                >
                    <div className='SelfHostedPurchaseModal'>
                        {<div className={classNames('form-view', {'form-view--hide': !showForm})}>
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
                                    <div className='section-title'>
                                        <FormattedMessage
                                            id='payment_form.credit_card'
                                            defaultMessage='Credit Card'
                                        />
                                    </div>
                                    <div className='form-row'>
                                        <CardInput
                                            forwardedRef={cardRef}
                                            required={true}
                                            onCardInputChange={handleCardInputChange}
                                            theme={theme}
                                        />
                                    </div>
                                    <div className='form-row'>
                                        <Input
                                            name='organization'
                                            type='text'
                                            value={state.organization}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                dispatch({type: 'set_organization', data: e.target.value});
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
                                            value={state.cardName}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                dispatch({type: 'set_cardName', data: e.target.value});
                                            }}
                                            placeholder={intl.formatMessage({
                                                id: 'payment_form.name_on_card',
                                                defaultMessage: 'Name on Card',
                                            })}
                                            required={true}
                                        />
                                    </div>
                                    <div className='section-title'>
                                        <FormattedMessage
                                            id='payment_form.billing_address'
                                            defaultMessage='Billing address'
                                        />
                                    </div>
                                    <AddressComponent
                                        testPrefix='selfHostedRenewal'
                                        type='billing'
                                        addressReducer={billingAddressReducer}
                                    />
                                    <ChooseDifferentShipping
                                        shippingIsSame={state.shippingSame}
                                        setShippingIsSame={(val: boolean) => {
                                            dispatch({type: 'set_shippingSame', data: val});
                                        }}
                                    />
                                    {!state.shippingSame && (
                                        <>
                                            <div className='section-title'>
                                                <FormattedMessage
                                                    id='payment_form.shipping_address'
                                                    defaultMessage='Shipping Address'
                                                />
                                            </div>
                                            <AddressComponent
                                                type='shipping'
                                                testPrefix='selfHostedRenewalBilling'
                                                addressReducer={shippingAddressReducer}
                                            />
                                        </>
                                    )}
                                    <Terms
                                        agreed={state.agreedTerms}
                                        setAgreed={(data: boolean) => {
                                            dispatch({type: 'set_agreedTerms', data});
                                        }}
                                    />
                                </div>
                            </div>
                            <div className='rhs'>
                                <SelfHostedCard
                                    desiredPlanName={desiredPlanName}
                                    desiredProduct={desiredProduct}
                                    seats={state.seats}
                                    currentUsers={currentUsers}
                                    updateSeats={(seats: Seats) => {
                                        dispatch({type: 'set_seats', data: seats});
                                    }}
                                    canSubmit={canSubmitForm}
                                    currentProductSku={currentProductSku}
                                    submit={submit}
                                />
                            </div>
                        </div>}
                        {((state.succeeded || progress === SelfHostedRenewalProgress.CREATED_LICENSE) && hasLicense) && !state.error && !state.submitting && (
                            <SuccessPage
                                onClose={controlModal.close}
                                planName={desiredPlanName}
                                isRenewal={true}
                            />
                        )}
                        {state.submitting && (
                            <Submitting
                                desiredPlanName={desiredPlanName}
                                progressBar={state.progressBar}
                            />
                        )}
                        {state.error && (
                            <ErrorPage
                                nextAction={errorAction}
                                canRetry={canRetry}
                                errorType={canRetry ? 'generic' : 'failed_export'}
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
