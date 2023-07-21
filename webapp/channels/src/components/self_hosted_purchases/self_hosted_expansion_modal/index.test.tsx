// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SelfHostedSignupForm, SelfHostedSignupProgress} from '@mattermost/types/hosted_customer';
import {DeepPartial} from '@mattermost/types/utilities';
import moment from 'moment-timezone';
import React from 'react';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {
    fireEvent,
    renderWithIntlAndStore,
    screen,
    waitFor,
} from 'tests/react_testing_utils';
import {GlobalState} from 'types/store';
import {SelfHostedProducts, ModalIdentifiers, RecurringIntervals} from 'utils/constants';
import {TestHelper as TH} from 'utils/test_helper';

import SelfHostedExpansionModal, {makeInitialState, canSubmit, FormState} from './';

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

const existingUsers = 10;

const mockProfessionalProduct = TH.getProductMock({
    id: 'prod_professional',
    name: 'Professional',
    sku: SelfHostedProducts.PROFESSIONAL,
    price_per_seat: 7.5,
    recurring_interval: RecurringIntervals.MONTH,
});

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
            confirmSelfHostedExpansion: () => Promise.resolve({
                progress: mockCreatedLicense,
                license: {Users: existingUsers * 2},
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

jest.mock('utils/hosted_customer', () => {
    const original = jest.requireActual('utils/hosted_customer');
    return {
        __esModule: true,
        ...original,
        findSelfHostedProductBySku: () => {
            return mockProfessionalProduct;
        },
    };
});

const productName = SelfHostedProducts.PROFESSIONAL;

// Licensed expiry set as 3 months from the current date (rolls over to new years).
let licenseExpiry = moment();
const monthsUntilLicenseExpiry = 3;
licenseExpiry = licenseExpiry.add(monthsUntilLicenseExpiry, 'months');

const initialState: DeepPartial<GlobalState> = {
    views: {
        modals: {
            modalState: {
                [ModalIdentifiers.SELF_HOSTED_EXPANSION]: {
                    open: true,
                },
            },
        },
    },
    storage: {
        storage: {},
    },
    entities: {
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
                SkuName: productName,
                Sku: productName,
                Users: '50',
                ExpiresAt: licenseExpiry.valueOf().toString(),
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
            filteredStats: {
                total_users_count: 100,
            },
        },
        hostedCustomer: {
            products: {
                productsLoaded: true,
                products: {
                    prod_professional: mockProfessionalProduct,
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

function selectDropdownValue(testId: string, value: string) {
    fireEvent.change(screen.getByTestId(testId).querySelector('input') as any, valueEvent(value));
    fireEvent.click(screen.getByTestId(testId).querySelector('.DropDown__option--is-focused') as any);
}

function changeByTestId(testId: string, value: string) {
    fireEvent.change(screen.getByTestId(testId).querySelector('input') as any, valueEvent(value));
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
    seats: string;
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
    seats: '50',
    agree: true,
};

function fillForm(form: PurchaseForm) {
    changeByPlaceholder('Card number', form.card);
    changeByPlaceholder('Organization Name', form.org);
    changeByPlaceholder('Name on Card', form.name);
    selectDropdownValue('selfHostedExpansionCountrySelector', form.country);
    changeByPlaceholder('Address', form.address);
    changeByPlaceholder('City', form.city);
    selectDropdownValue('selfHostedExpansionStateSelector', form.state);
    changeByPlaceholder('Zip/Postal Code', form.zip);
    if (form.agree) {
        fireEvent.click(screen.getByText('I have read and agree', {exact: false}));
    }

    const completeButton = screen.getByText('Complete purchase');

    if (form === defaultSuccessForm) {
        expect(completeButton).toBeEnabled();
    }

    return completeButton;
}

describe('SelfHostedExpansionModal Open', () => {
    it('renders the form', () => {
        renderWithIntlAndStore(<div id='root-portal'><SelfHostedExpansionModal/></div>, initialState);

        screen.getByText('Provide your payment details');
        screen.getByText('Add new seats');
        screen.getByText('Contact Sales');
        screen.getByText('Cost per user', {exact: false});

        // screen.getByText(productName, {normalizer: (val) => {return val.charAt(0).toUpperCase() + val.slice(1)}});
        screen.getByText('Your credit card will be charged today.');
        screen.getByText('See how billing works', {exact: false});
    });

    it('filling the form enables expansion', () => {
        renderWithIntlAndStore(<div id='root-portal'><SelfHostedExpansionModal/></div>, initialState);
        expect(screen.getByText('Complete purchase')).toBeDisabled();
        fillForm(defaultSuccessForm);
    });

    it('happy path submit shows success screen when confirmation succeeds', async () => {
        renderWithIntlAndStore(<div id='root-portal'><SelfHostedExpansionModal/></div>, initialState);
        expect(screen.getByText('Complete purchase')).toBeDisabled();

        const upgradeButton = fillForm(defaultSuccessForm);
        upgradeButton.click();

        expect(screen.findByText('The license has been automatically applied')).toBeTruthy();
    });

    it('happy path submit shows submitting screen while requesting confirmation', async () => {
        renderWithIntlAndStore(<div id='root-portal'><SelfHostedExpansionModal/></div>, initialState);
        expect(screen.getByText('Complete purchase')).toBeDisabled();

        const upgradeButton = fillForm(defaultSuccessForm);
        upgradeButton.click();

        await waitFor(() => expect(document.getElementsByClassName('submitting')[0]).toBeTruthy(), {timeout: 1234});
    });

    it('sad path submit shows error screen', async () => {
        renderWithIntlAndStore(<div id='root-portal'><SelfHostedExpansionModal/></div>, initialState);
        expect(screen.getByText('Complete purchase')).toBeDisabled();
        fillForm(defaultSuccessForm);
        changeByPlaceholder('Organization Name', failOrg);

        const upgradeButton = screen.getByText('Complete purchase');
        expect(upgradeButton).toBeEnabled();
        upgradeButton.click();
        await waitFor(() => expect(screen.getByText('Sorry, the payment verification failed')).toBeTruthy(), {timeout: 1234});
    });
});

describe('SelfHostedExpansionModal RHS Card', () => {
    it('New seats input should be pre-populated with the difference from the active users and licensed seats', () => {
        renderWithIntlAndStore(<div id='root-portal'><SelfHostedExpansionModal/></div>, initialState);

        const expectedPrePopulatedSeats = (initialState.entities?.users?.filteredStats?.total_users_count || 1) - parseInt(initialState.entities?.general?.license?.Users || '1', 10);

        const seatsField = screen.getByTestId('seatsInput').querySelector('input');
        expect(seatsField).toBeInTheDocument();
        expect(seatsField?.value).toBe(expectedPrePopulatedSeats.toString());
    });

    it('Seat input only allows users to fill input with the licensed seats and active users difference if it is not 0', () => {
        const expectedUserOverage = '50';

        renderWithIntlAndStore(<div id='root-portal'><SelfHostedExpansionModal/></div>, initialState);
        fillForm(defaultSuccessForm);

        // The seat input should already have the expected value.
        expect(screen.getByTestId('seatsInput').querySelector('input')?.value).toContain(expectedUserOverage);

        // Try to set an undefined value.
        fireEvent.change(screen.getByTestId('seatsInput').querySelector('input') as HTMLElement, undefined);

        // Expecting the seats input to now contain the difference between active users and licensed seats.
        expect(screen.getByTestId('seatsInput').querySelector('input')?.value).toContain(expectedUserOverage);
        expect(screen.getByText('Complete purchase')).toBeEnabled();
    });

    it('New seats input cannot be less than 1', () => {
        const state = mergeObjects(initialState, {
            entities: {
                users: {
                    filteredStats: {
                        total_users_count: 50,
                    },
                },
            },
        });

        const expectedAddNewSeats = '1';

        renderWithIntlAndStore(<div id='root-portal'><SelfHostedExpansionModal/></div>, state);
        fillForm(defaultSuccessForm);

        // Try to set a negative value.
        fireEvent.change(screen.getByTestId('seatsInput').querySelector('input') as HTMLElement, -10);
        expect(screen.getByTestId('seatsInput').querySelector('input')?.value).toContain(expectedAddNewSeats);

        // Try to set a 0 value.
        fireEvent.change(screen.getByTestId('seatsInput').querySelector('input') as HTMLElement, 0);
        expect(screen.getByTestId('seatsInput').querySelector('input')?.value).toContain(expectedAddNewSeats);
    });

    it('Cost per User should be represented as the current subscription price multiplied by the remaining months', () => {
        renderWithIntlAndStore(<div id='root-portal'><SelfHostedExpansionModal/></div>, initialState);

        const expectedCostPerUser = monthsUntilLicenseExpiry * mockProfessionalProduct.price_per_seat;

        const costPerUser = document.getElementsByClassName('costPerUser')[0];
        expect(costPerUser).toBeInTheDocument();
        expect(costPerUser.innerHTML).toContain('Cost per user<br>$' + mockProfessionalProduct.price_per_seat.toFixed(2) + ' x ' + monthsUntilLicenseExpiry + ' months');

        const costAmount = document.getElementsByClassName('costAmount')[0];
        expect(costAmount).toBeInTheDocument();
        expect(costAmount.innerHTML).toContain('$' + expectedCostPerUser);
    });

    it('Total cost User should be represented as the current subscription price multiplied by the remaining months multiplied by the number of users', () => {
        renderWithIntlAndStore(<div id='root-portal'><SelfHostedExpansionModal/></div>, initialState);
        const seatsInputValue = 100;
        changeByTestId('seatsInput', seatsInputValue.toString());

        const expectedTotalCost = monthsUntilLicenseExpiry * mockProfessionalProduct.price_per_seat * seatsInputValue;

        const costAmount = document.getElementsByClassName('totalCostAmount')[0];
        expect(costAmount).toBeInTheDocument();
        expect(costAmount).toHaveTextContent(Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(expectedTotalCost));
    });
});

describe('SelfHostedExpansionModal Submit', () => {
    function makeHappyPathState(): FormState {
        return {
            address: 'string',
            address2: 'string',
            city: 'string',
            state: 'string',
            country: 'string',
            postalCode: '12345',
            shippingAddress: 'string',
            shippingAddress2: 'string',
            shippingCity: 'string',
            shippingState: 'string',
            shippingCountry: 'string',
            shippingPostalCode: '12345',
            shippingSame: false,
            agreedTerms: true,
            cardName: 'string',
            organization: 'string',
            cardFilled: true,
            seats: 1,
            submitting: false,
            succeeded: false,
            progressBar: 0,
            error: '',
        };
    }
    it('if submitting, can not submit again', () => {
        const state = makeHappyPathState();
        state.submitting = true;
        expect(canSubmit(state, SelfHostedSignupProgress.CREATED_LICENSE)).toBe(false);
    });

    it('if created license, can submit', () => {
        const state = makeInitialState(1);
        state.submitting = false;
        expect(canSubmit(state, SelfHostedSignupProgress.CREATED_LICENSE)).toBe(true);
    });

    it('if paid, can submit', () => {
        const state = makeInitialState(1);
        state.submitting = false;
        expect(canSubmit(state, SelfHostedSignupProgress.PAID)).toBe(true);
    });

    it('if created subscription, can submit', () => {
        const state = makeInitialState(1);
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
        state.seats = 0;
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
