// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    SelfHostedSignupProgress,
    SelfHostedSignupCustomerResponse,
} from '@mattermost/types/hosted_customer';
import {ValueOf} from '@mattermost/types/utilities';
import {StripeCardElementChangeEvent} from '@stripe/stripe-js';
import classNames from 'classnames';
import React, {useEffect, useRef, useReducer, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {confirmSelfHostedSignup} from 'actions/hosted_customer';
import {trackEvent, pageVisited} from 'actions/telemetry_actions';
import {HostedCustomerTypes} from 'mattermost-redux/action_types';
import {getLicenseConfig} from 'mattermost-redux/actions/general';
import {Client4} from 'mattermost-redux/client';
import {getAdminAnalytics} from 'mattermost-redux/selectors/entities/admin';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getSelfHostedProducts, getSelfHostedSignupProgress} from 'mattermost-redux/selectors/entities/hosted_customer';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {DispatchFunc} from 'mattermost-redux/types/actions';
import {isCwsMockMode} from 'selectors/cloud';
import {isModalOpen} from 'selectors/views/modals';

import ChooseDifferentShipping from 'components/choose_different_shipping';
import useControlSelfHostedPurchaseModal from 'components/common/hooks/useControlSelfHostedPurchaseModal';
import useFetchStandardAnalytics from 'components/common/hooks/useFetchStandardAnalytics';
import useLoadStripe from 'components/common/hooks/useLoadStripe';
import BackgroundSvg from 'components/common/svg_images_components/background_svg';
import UpgradeSvg from 'components/common/svg_images_components/upgrade_svg';
import CardInput, {CardInputType} from 'components/payment_form/card_input';
import RootPortal from 'components/root_portal';
import Input from 'components/widgets/inputs/input/input';
import FullScreenModal from 'components/widgets/modals/full_screen_modal';

import {Seats, errorInvalidNumber} from '../../seats_calculator';
import Address from '../address';
import {STORAGE_KEY_PURCHASE_IN_PROGRESS} from '../constants';
import ContactSalesLink from '../contact_sales_link';
import StripeProvider from '../stripe_provider';
import {GlobalState} from 'types/store';
import {
    ModalIdentifiers,
    StatTypes,
    TELEMETRY_CATEGORIES,
} from 'utils/constants';
import {inferNames} from 'utils/hosted_customer';

import ErrorPage from './error';
import SelfHostedCard from './self_hosted_card';
import Submitting, {convertProgressToBar} from './submitting';
import SuccessPage from './success_page';
import Terms from './terms';
import {SetPrefix, UnionSetActions} from './types';
import useNoEscape from './useNoEscape';

import './self_hosted_purchase_modal.scss';

export interface State {

    // billing address
    address: string;
    address2: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;

    // shipping address
    shippingSame: boolean;
    shippingAddress: string;
    shippingAddress2: string;
    shippingCity: string;
    shippingState: string;
    shippingCountry: string;
    shippingPostalCode: string;

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
        address: '',
        address2: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',

        shippingSame: true,
        shippingAddress: '',
        shippingAddress2: '',
        shippingCity: '',
        shippingState: '',
        shippingCountry: '',
        shippingPostalCode: '',

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
    'address',
    'address2',
    'city',
    'country',
    'state',
    'postalCode',

    // shipping address
    'shippingSame',
    'shippingAddress',
    'shippingAddress2',
    'shippingCity',
    'shippingState',
    'shippingCountry',
    'shippingPostalCode',

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
        const firstLongStep = SelfHostedSignupProgress.CONFIRMED_INTENT;
        if (state.progressBar >= convertProgressToBar(firstLongStep) && state.progressBar <= maxFakeProgress - maxFakeProgressIncrement) {
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

export function canSubmit(state: State, progress: ValueOf<typeof SelfHostedSignupProgress>) {
    if (state.submitting) {
        return false;
    }

    let validAddress = Boolean(
        state.organization &&
            state.address &&
            state.city &&
            state.state &&
            state.postalCode &&
            state.country,
    );
    if (!state.shippingSame) {
        validAddress = validAddress && Boolean(
            state.shippingAddress &&
            state.shippingCity &&
            state.shippingState &&
            state.shippingPostalCode &&
            state.shippingCountry,

        );
    }
    const validCard = Boolean(
        state.cardName &&
        state.cardFilled,
    );
    const validSeats = !state.seats.error;
    switch (progress) {
    case SelfHostedSignupProgress.PAID:
    case SelfHostedSignupProgress.CREATED_LICENSE:
    case SelfHostedSignupProgress.CREATED_SUBSCRIPTION:
        return true;
    case SelfHostedSignupProgress.CONFIRMED_INTENT: {
        return Boolean(
            validAddress &&
            validSeats &&
            state.agreedTerms,
        );
    }
    case SelfHostedSignupProgress.START:
    case SelfHostedSignupProgress.CREATED_CUSTOMER:
    case SelfHostedSignupProgress.CREATED_INTENT:
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
    const controlModal = useControlSelfHostedPurchaseModal({productId: props.productId});
    const show = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.SELF_HOSTED_PURCHASE));
    const progress = useSelector(getSelfHostedSignupProgress);
    const user = useSelector(getCurrentUser);
    const theme = useSelector(getTheme);
    const analytics = useSelector(getAdminAnalytics) || {};
    const desiredProduct = useSelector(getSelfHostedProducts)[props.productId];
    const desiredProductName = desiredProduct?.name || '';
    const desiredPlanName = getPlanNameFromProductName(desiredProductName);
    const currentUsers = analytics[StatTypes.TOTAL_USERS] as number;
    const cwsMockMode = useSelector(isCwsMockMode);
    const hasLicense = Object.keys(useSelector(getLicense) || {}).length > 0;

    const intl = useIntl();
    const fakeProgressRef = useRef<FakeProgress>({
    });

    const [state, dispatch] = useReducer(reducer, initialState);
    const reduxDispatch = useDispatch<DispatchFunc>();

    const cardRef = useRef<CardInputType | null>(null);
    const modalRef = useRef();
    const [stripeLoadHint, setStripeLoadHint] = useState(Math.random());

    const stripeRef = useLoadStripe(stripeLoadHint);
    const showForm = progress !== SelfHostedSignupProgress.PAID && progress !== SelfHostedSignupProgress.CREATED_LICENSE && !state.submitting && !state.error && !state.succeeded;

    useEffect(() => {
        if (typeof currentUsers === 'number' && (currentUsers > parseInt(state.seats.quantity, 10) || !parseInt(state.seats.quantity, 10))) {
            dispatch({type: 'set_seats',
                data: {
                    quantity: currentUsers.toString(),
                    error: null,
                }});
        }
    }, [currentUsers]);
    useEffect(() => {
        pageVisited(
            TELEMETRY_CATEGORIES.CLOUD_PURCHASING,
            'pageview_self_hosted_purchase',
        );

        localStorage.setItem(STORAGE_KEY_PURCHASE_IN_PROGRESS, 'true');
        return () => {
            localStorage.removeItem(STORAGE_KEY_PURCHASE_IN_PROGRESS);
        };
    }, []);

    useEffect(() => {
        const progressBar = convertProgressToBar(progress);
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

    async function submit() {
        let submitProgress = progress;
        dispatch({type: 'set_submitting', data: true});
        let signupCustomerResult: SelfHostedSignupCustomerResponse | null = null;
        try {
            const [firstName, lastName] = inferNames(user, state.cardName);

            const billingAddress = {
                city: state.city,
                country: state.country,
                line1: state.address,
                line2: state.address2,
                postal_code: state.postalCode,
                state: state.state,
            };
            signupCustomerResult = await Client4.createCustomerSelfHostedSignup({
                first_name: firstName,
                last_name: lastName,
                billing_address: billingAddress,
                shipping_address: state.shippingSame ? billingAddress : {
                    city: state.shippingCity,
                    country: state.shippingCountry,
                    line1: state.shippingAddress,
                    line2: state.shippingAddress2,
                    postal_code: state.shippingPostalCode,
                    state: state.shippingState,
                },
                organization: state.organization,
            });
        } catch {
            dispatch({type: 'set_error', data: 'Failed to submit payment information'});
            return;
        }

        if (signupCustomerResult === null || !signupCustomerResult.progress) {
            dispatch({type: 'set_error', data: 'Failed to submit payment information'});
            return;
        }
        if (progress === SelfHostedSignupProgress.START || progress === SelfHostedSignupProgress.CREATED_CUSTOMER) {
            reduxDispatch({
                type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_SIGNUP_PROGRESS,
                data: signupCustomerResult.progress,
            });
            submitProgress = signupCustomerResult.progress;
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
            const finished = await reduxDispatch(confirmSelfHostedSignup(
                stripeRef.current,
                {
                    id: signupCustomerResult.setup_intent_id,
                    client_secret: signupCustomerResult.setup_intent_secret,
                },
                cwsMockMode,
                {
                    address: state.address,
                    address2: state.address2,
                    city: state.city,
                    state: state.state,
                    country: state.country,
                    postalCode: state.postalCode,
                    name: state.cardName,
                    card,
                },
                submitProgress,
                {
                    product_id: props.productId,
                    add_ons: [],
                    seats: parseInt(state.seats.quantity, 10),
                },
            ));
            if (finished.data) {
                trackEvent(
                    TELEMETRY_CATEGORIES.SELF_HOSTED_PURCHASING,
                    'purchase_success',
                    {seats: parseInt(finished.data?.Users, 10) || 0, users: currentUsers},
                );
                dispatch({type: 'succeeded'});

                reduxDispatch({
                    type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_SIGNUP_PROGRESS,
                    data: SelfHostedSignupProgress.CREATED_LICENSE,
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
    const canSubmitForm = canSubmit(state, progress);

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
                        type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_SIGNUP_PROGRESS,
                        data: data.progress,
                    });
                });
        } catch {
            // swallow error ok here
        }
    };
    const errorAction = () => {
        if (canRetry && (progress === SelfHostedSignupProgress.CREATED_SUBSCRIPTION || progress === SelfHostedSignupProgress.PAID || progress === SelfHostedSignupProgress.CREATED_LICENSE)) {
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
                            TELEMETRY_CATEGORIES.SELF_HOSTED_PURCHASING,
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
                                    <Address
                                        type='billing'
                                        country={state.country}
                                        changeCountry={(option) => {
                                            dispatch({type: 'set_country', data: option.value});
                                        }}
                                        address={state.address}
                                        changeAddress={(e) => {
                                            dispatch({type: 'set_address', data: e.target.value});
                                        }}
                                        address2={state.address2}
                                        changeAddress2={(e) => {
                                            dispatch({type: 'set_address2', data: e.target.value});
                                        }}
                                        city={state.city}
                                        changeCity={(e) => {
                                            dispatch({type: 'set_city', data: e.target.value});
                                        }}
                                        state={state.state}
                                        changeState={(state: string) => {
                                            dispatch({type: 'set_state', data: state});
                                        }}
                                        postalCode={state.postalCode}
                                        changePostalCode={(e) => {
                                            dispatch({type: 'set_postalCode', data: e.target.value});
                                        }}
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
                                            <Address
                                                type='shipping'
                                                country={state.shippingCountry}
                                                changeCountry={(option) => {
                                                    dispatch({type: 'set_shippingCountry', data: option.value});
                                                }}
                                                address={state.shippingAddress}
                                                changeAddress={(e) => {
                                                    dispatch({type: 'set_shippingAddress', data: e.target.value});
                                                }}
                                                address2={state.shippingAddress2}
                                                changeAddress2={(e) => {
                                                    dispatch({type: 'set_shippingAddress2', data: e.target.value});
                                                }}
                                                city={state.shippingCity}
                                                changeCity={(e) => {
                                                    dispatch({type: 'set_shippingCity', data: e.target.value});
                                                }}
                                                state={state.shippingState}
                                                changeState={(state: string) => {
                                                    dispatch({type: 'set_shippingState', data: state});
                                                }}
                                                postalCode={state.shippingPostalCode}
                                                changePostalCode={(e) => {
                                                    dispatch({type: 'set_shippingPostalCode', data: e.target.value});
                                                }}
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
                                    submit={submit}
                                />
                            </div>
                        </div>}
                        {((state.succeeded || progress === SelfHostedSignupProgress.CREATED_LICENSE) && hasLicense) && !state.error && !state.submitting && (
                            <SuccessPage
                                onClose={controlModal.close}
                                planName={desiredPlanName}
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
