// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {SelfHostedSignupProgress} from '@mattermost/types/hosted_customer';
import type {SelfHostedSignupForm} from '@mattermost/types/hosted_customer';
import type {DeepPartial} from '@mattermost/types/utilities';

import {
    fireEvent,
    renderWithIntlAndStore,
    screen,
    waitFor,
} from 'tests/react_testing_utils';
import {SelfHostedProducts, ModalIdentifiers} from 'utils/constants';
import {TestHelper as TH} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import SelfHostedPurchaseModal, {makeInitialState, canSubmit} from '.';
import type {State} from '.';

interface MockCardInputProps {
    onCardInputChange: (event: {complete: boolean}) => void;
    forwardedRef: React.MutableRefObject<any>;
}

// number borrowed from stripe
const successCardNumber = '4242424242424242';
function MockCardInput(props: MockCardInputProps) {
    props.forwardedRef.current = {
        getCard: () => ({}),
    };
    return (
        <input
            placeholder='Card number'
            type='text'
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                if (e.target.value === successCardNumber) {
                    props.onCardInputChange({complete: true});
                }
            }}
        />
    );
}

jest.mock('components/payment_form/card_input', () => {
    const original = jest.requireActual('components/payment_form/card_input');
    return {
        ...original,
        __esModule: true,
        default: MockCardInput,
    };
});

jest.mock('components/self_hosted_purchases/stripe_provider', () => {
    return function(props: {children: React.ReactNode | React.ReactNodeArray}) {
        return props.children;
    };
});

jest.mock('components/common/hooks/useLoadStripe', () => {
    return function() {
        return {current: {
            stripe: {},

        }};
    };
});

const mockCreatedIntent = SelfHostedSignupProgress.CREATED_INTENT;
const mockCreatedLicense = SelfHostedSignupProgress.CREATED_LICENSE;
const failOrg = 'failorg';

const existingUsers = 11;

jest.mock('mattermost-redux/client', () => {
    const original = jest.requireActual('mattermost-redux/client');
    return {
        __esModule: true,
        ...original,
        Client4: {
            ...original.Client4,
            pageVisited: jest.fn(),
            setAcceptLanguage: jest.fn(),
            trackEvent: jest.fn(),
            createCustomerSelfHostedSignup: (form: SelfHostedSignupForm) => {
                if (form.organization === failOrg) {
                    throw new Error('error creating customer');
                }
                return Promise.resolve({
                    progress: mockCreatedIntent,
                });
            },
            confirmSelfHostedSignup: () => Promise.resolve({
                progress: mockCreatedLicense,
                license: {Users: existingUsers * 2},
            }),
            getClientLicenseOld: () => Promise.resolve({
                data: {Sku: 'Enterprise'},
            }),
        },
    };
});

jest.mock('components/payment_form/stripe', () => {
    const original = jest.requireActual('components/payment_form/stripe');
    return {
        __esModule: true,
        ...original,
        getConfirmCardSetup: () => () => () => ({setupIntent: {status: 'succeeded'}, error: null}),
    };
});

const productName = 'Professional';

const initialState: DeepPartial<GlobalState> = {
    views: {
        modals: {
            modalState: {
                [ModalIdentifiers.SELF_HOSTED_PURCHASE]: {
                    open: true,
                },
            },
        },
    },
    storage: {
        storage: {},
    },
    entities: {
        admin: {
            analytics: {
                TOTAL_USERS: existingUsers,
            },
        },
        teams: {
            currentTeamId: '',
        },
        preferences: {
            myPreferences: {
                theme: {},
            },
        },
        general: {
            config: {
                EnableDeveloper: 'false',
            },
            license: {
                Sku: 'Enterprise',
            },
        },
        cloud: {
            subscription: {},
        },
        users: {
            currentUserId: 'adminUserId',
            profiles: {
                adminUserId: TH.getUserMock({
                    id: 'adminUserId',
                    roles: 'admin',
                    first_name: 'first',
                    last_name: 'admin',
                }),
                otherUserId: TH.getUserMock({
                    id: 'otherUserId',
                    roles: '',
                    first_name: '',
                    last_name: '',
                }),
            },
        },
        hostedCustomer: {
            products: {
                productsLoaded: true,
                products: {
                    prod_professional: TH.getProductMock({
                        id: 'prod_professional',
                        name: 'Professional',
                        sku: SelfHostedProducts.PROFESSIONAL,
                        price_per_seat: 7.5,

                    }),

                },
            },
            signupProgress: SelfHostedSignupProgress.START,
        },
    },
};

const valueEvent = (value: any) => ({target: {value}});
function changeByPlaceholder(sel: string, val: any) {
    fireEvent.change(screen.getByPlaceholderText(sel), valueEvent(val));
}

// having issues with normal selection of texts and clicks.
function selectDropdownValue(testId: string, value: string) {
    fireEvent.change(screen.getByTestId(testId).querySelector('input') as any, valueEvent(value));
    fireEvent.click(screen.getByTestId(testId).querySelector('.DropDown__option--is-focused') as any);
}

interface PurchaseForm {
    card: string;
    org: string;
    name: string;
    country: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    agree: boolean;

}

const defaultSuccessForm: PurchaseForm = {
    card: successCardNumber,
    org: 'My org',
    name: 'The Cardholder',
    country: 'United States of America',
    address: '123 Main Street',
    city: 'Minneapolis',
    state: 'MN',
    zip: '55423',
    agree: true,
};
function fillForm(form: PurchaseForm) {
    changeByPlaceholder('Card number', form.card);
    changeByPlaceholder('Organization Name', form.org);
    changeByPlaceholder('Name on Card', form.name);
    selectDropdownValue('selfHostedPurchaseCountrySelector', form.country);
    changeByPlaceholder('Address', form.address);
    changeByPlaceholder('City', form.city);
    selectDropdownValue('selfHostedPurchaseStateSelector', form.state);
    changeByPlaceholder('Zip/Postal Code', form.zip);
    if (form.agree) {
        fireEvent.click(screen.getByText('I have read and agree', {exact: false}));
    }

    // not changing the license seats number,
    // because it is expected to be pre-filled with the correct number of seats.

    const upgradeButton = screen.getByText('Upgrade');

    // while this will will not if the caller passes in an object
    // that has member equality but not reference equality, this is
    // good enough for the limited usage this function has
    if (form === defaultSuccessForm) {
        expect(upgradeButton).toBeEnabled();
    }

    return upgradeButton;
}

describe('SelfHostedPurchaseModal', () => {
    it('renders the form', () => {
        renderWithIntlAndStore(<div id='root-portal'><SelfHostedPurchaseModal productId={'prod_professional'}/></div>, initialState);

        // check title, and some of the most prominent details and secondary actions
        screen.getByText('Provide your payment details');
        screen.getByText('Contact Sales');
        screen.getByText('USD per seat/month', {exact: false});
        screen.getByText('billed annually', {exact: false});
        screen.getByText(productName);
        screen.getByText('You will be billed today. Your license will be applied automatically', {exact: false});
        screen.getByText('See how billing works', {exact: false});
    });

    it('filling the form enables signup', () => {
        renderWithIntlAndStore(<div id='root-portal'><SelfHostedPurchaseModal productId={'prod_professional'}/></div>, initialState);
        expect(screen.getByText('Upgrade')).toBeDisabled();
        fillForm(defaultSuccessForm);
    });

    it('disables signup if too few seats chosen', () => {
        renderWithIntlAndStore(<div id='root-portal'><SelfHostedPurchaseModal productId={'prod_professional'}/></div>, initialState);
        fillForm(defaultSuccessForm);

        const tooFewSeats = existingUsers - 1;
        fireEvent.change(screen.getByTestId('selfHostedPurchaseSeatsInput'), valueEvent(tooFewSeats.toString()));
        expect(screen.getByText('Upgrade')).toBeDisabled();
        screen.getByText('Your workspace currently has 11 users', {exact: false});
    });

    it('Minimum of 10 seats is required for sign up', () => {
        renderWithIntlAndStore(<div id='root-portal'><SelfHostedPurchaseModal productId={'prod_professional'}/></div>, initialState);
        fillForm(defaultSuccessForm);

        const tooFewSeats = 9;
        fireEvent.change(screen.getByTestId('selfHostedPurchaseSeatsInput'), valueEvent(tooFewSeats.toString()));
        expect(screen.getByText('Upgrade')).toBeDisabled();
        screen.getByText('Minimum of 10 seats required', {exact: false});
    });

    it('happy path submit shows success screen', async () => {
        renderWithIntlAndStore(<div id='root-portal'><SelfHostedPurchaseModal productId={'prod_professional'}/></div>, initialState);
        expect(screen.getByText('Upgrade')).toBeDisabled();
        const upgradeButton = fillForm(defaultSuccessForm);

        upgradeButton.click();
        await waitFor(() => expect(screen.getByText(`You're now subscribed to ${productName}`)).toBeTruthy(), {timeout: 1234});
    });

    it('sad path submit shows error screen', async () => {
        renderWithIntlAndStore(<div id='root-portal'><SelfHostedPurchaseModal productId={'prod_professional'}/></div>, initialState);
        expect(screen.getByText('Upgrade')).toBeDisabled();
        fillForm(defaultSuccessForm);
        changeByPlaceholder('Organization Name', failOrg);

        const upgradeButton = screen.getByText('Upgrade');
        expect(upgradeButton).toBeEnabled();
        upgradeButton.click();
        await waitFor(() => expect(screen.getByText('Sorry, the payment verification failed')).toBeTruthy(), {timeout: 1234});
    });
});

describe('SelfHostedPurchaseModal :: canSubmit', () => {
    function makeHappyPathState(): State {
        return {

            address: 'string',
            address2: 'string',
            city: 'string',
            state: 'string',
            country: 'string',
            postalCode: '12345',

            shippingSame: true,
            shippingAddress: '',
            shippingAddress2: '',
            shippingCity: '',
            shippingState: '',
            shippingCountry: '',
            shippingPostalCode: '',

            cardName: 'string',
            organization: 'string',
            agreedTerms: true,
            cardFilled: true,
            seats: {
                quantity: '12',
                error: null,
            },
            submitting: false,
            succeeded: false,
            progressBar: 0,
            error: '',
        };
    }
    it('if submitting, can not submit', () => {
        const state = makeHappyPathState();
        state.submitting = true;
        expect(canSubmit(state, SelfHostedSignupProgress.CREATED_LICENSE)).toBe(false);
    });
    it('if created license, can submit', () => {
        const state = makeInitialState();
        state.submitting = false;
        expect(canSubmit(state, SelfHostedSignupProgress.CREATED_LICENSE)).toBe(true);
    });

    it('if paid, can submit', () => {
        const state = makeInitialState();
        state.submitting = false;
        expect(canSubmit(state, SelfHostedSignupProgress.PAID)).toBe(true);
    });

    it('if created subscription, can submit', () => {
        const state = makeInitialState();
        state.submitting = false;
        expect(canSubmit(state, SelfHostedSignupProgress.CREATED_SUBSCRIPTION)).toBe(true);
    });

    it('if all details filled and card has not been confirmed, can submit', () => {
        const state = makeHappyPathState();
        expect(canSubmit(state, SelfHostedSignupProgress.START)).toBe(true);
        expect(canSubmit(state, SelfHostedSignupProgress.CREATED_CUSTOMER)).toBe(true);
        expect(canSubmit(state, SelfHostedSignupProgress.CREATED_INTENT)).toBe(true);
    });

    it('if card name missing and card has not been confirmed, can not submit', () => {
        const state = makeHappyPathState();
        state.cardName = '';
        expect(canSubmit(state, SelfHostedSignupProgress.START)).toBe(false);
        expect(canSubmit(state, SelfHostedSignupProgress.CREATED_CUSTOMER)).toBe(false);
        expect(canSubmit(state, SelfHostedSignupProgress.CREATED_INTENT)).toBe(false);
    });

    it('if shipping address different and is not filled, can not submit', () => {
        const state = makeHappyPathState();
        state.shippingSame = false;
        expect(canSubmit(state, SelfHostedSignupProgress.START)).toBe(false);

        state.shippingAddress = 'more shipping info';
        state.shippingAddress2 = 'more shipping info';
        state.shippingCity = 'more shipping info';
        state.shippingState = 'more shipping info';
        state.shippingCountry = 'more shipping info';
        state.shippingPostalCode = 'more shipping info';
        expect(canSubmit(state, SelfHostedSignupProgress.START)).toBe(true);
    });

    it('if card number missing and card has not been confirmed, can not submit', () => {
        const state = makeHappyPathState();
        state.cardFilled = false;
        expect(canSubmit(state, SelfHostedSignupProgress.START)).toBe(false);
        expect(canSubmit(state, SelfHostedSignupProgress.CREATED_CUSTOMER)).toBe(false);
        expect(canSubmit(state, SelfHostedSignupProgress.CREATED_INTENT)).toBe(false);
    });

    it('if address not filled and card has not been confirmed, can not submit', () => {
        const state = makeHappyPathState();
        state.address = '';
        expect(canSubmit(state, SelfHostedSignupProgress.START)).toBe(false);
        expect(canSubmit(state, SelfHostedSignupProgress.CREATED_CUSTOMER)).toBe(false);
        expect(canSubmit(state, SelfHostedSignupProgress.CREATED_INTENT)).toBe(false);
    });

    it('if seats not valid and card has not been confirmed, can not submit', () => {
        const state = makeHappyPathState();
        state.seats.error = 'some seats error';
        expect(canSubmit(state, SelfHostedSignupProgress.START)).toBe(false);
        expect(canSubmit(state, SelfHostedSignupProgress.CREATED_CUSTOMER)).toBe(false);
        expect(canSubmit(state, SelfHostedSignupProgress.CREATED_INTENT)).toBe(false);
    });

    it('if did not agree to terms and card has not been confirmed, can not submit', () => {
        const state = makeHappyPathState();
        state.agreedTerms = false;
        expect(canSubmit(state, SelfHostedSignupProgress.START)).toBe(false);
        expect(canSubmit(state, SelfHostedSignupProgress.CREATED_CUSTOMER)).toBe(false);
        expect(canSubmit(state, SelfHostedSignupProgress.CREATED_INTENT)).toBe(false);
    });

    it('if card confirmed, card not required for submission', () => {
        const state = makeHappyPathState();
        state.cardFilled = false;
        state.cardName = '';
        expect(canSubmit(state, SelfHostedSignupProgress.CONFIRMED_INTENT)).toBe(true);
    });

    it('if passed unknown progress status, can not submit', () => {
        const state = makeHappyPathState();
        expect(canSubmit(state, 'unknown status' as any)).toBe(false);
    });
});
