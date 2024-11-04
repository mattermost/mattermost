// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// e.g. not_cloud cloud because we always want to exclude running automatically
// until we create the special self-hosted run setup
// Stage: @dev
// Group: @channels @enterprise @not_cloud @cloud @hosted_customer

// To run this locally, the necessary test setup is:
// * Ensure on latest mattermost-webapp, mattermost-server, enterprise
// * Ensure MM_SERVICESETTINGS_ENABLEDEVELOPER=false in server shell
// * Ensure CloudSettings.CWSURL is set to https://portal.test.cloud.mattermost.com
// * Ensure CloudSettings.CWSAPIURL is set to https://portal.internal.test.cloud.mattermost.com
// * Change mattermost-server utils/license.go to test public key
//     * e.g. see (https://github.com/mattermost/mattermost-server/pull/16778/files)

import {UserProfile} from '@mattermost/types/users';
import * as TIMEOUTS from '../../../../fixtures/timeouts';

function verifyPurchaseModal() {
    cy.contains('Provide your payment details');
    cy.contains('Contact Sales');
    cy.contains('Compare plans');
    cy.contains('Credit Card');
    cy.contains('Billing address');
    cy.contains('Enterprise Edition Subscription Terms');
    cy.contains('You will be billed today.');
}

interface PurchaseForm {
    card: string;
    expires: string;
    cvc: string;
    org: string;
    name: string;
    country: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    agree: boolean;
    seats?: number;
}
const additionalSeatsToPurchase = 10;
const successCardNumber = '4242424242424242';
const failCardNumber = '4000000000000002';
const defaultSuccessForm: PurchaseForm = {
    card: successCardNumber,
    expires: '424', // e.g. 4/24
    cvc: '242',
    org: 'My org',
    name: 'The Cardholder',
    country: 'United States of America',
    address: '123 Main Street',
    city: 'Minneapolis',
    state: 'Minnesota',
    zip: '55423',
    agree: true,
};

const prefilledProvinceCountryRegions = {
    'United States of America': true,
    Canada: true,
};

function changeByPlaceholder(placeholder: string, value: string) {
    cy.findByPlaceholderText(placeholder).type(value);
}
function selectDropdownValue(placeholder: string, value: string) {
    cy.contains(placeholder).click();
    cy.contains(value).click();
}

function fillForm(form: PurchaseForm, currentUsers: Cypress.Chainable<number>) {
    cy.uiGetPaymentCardInput().within(() => {
        cy.get('[name="cardnumber"]').should('be.enabled').clear().type(form.card);
        cy.get('[name="exp-date"]').should('be.enabled').clear().type(form.expires);
        cy.get('[name="cvc"]').should('be.enabled').clear().type(form.cvc);
    });

    changeByPlaceholder('Organization Name', form.org);

    changeByPlaceholder('Name on Card', form.name);
    selectDropdownValue('Country', form.country);
    changeByPlaceholder('Address', form.address);
    changeByPlaceholder('City', form.city);
    if (prefilledProvinceCountryRegions[form.country]) {
        selectDropdownValue('State/Province', form.state);
    } else {
        changeByPlaceholder('State/Province', form.state);
    }
    changeByPlaceholder('Zip/Postal Code', form.zip);

    if (form.agree) {
        cy.get('#self_hosted_purchase_terms').click();
    }

    if (form === defaultSuccessForm) {
        currentUsers.then((userCount) => {
            cy.findByTestId('selfHostedPurchaseSeatsInput').clear().type((userCount + additionalSeatsToPurchase).toString());
        });
    } else if (form.seats) {
        cy.findByTestId('selfHostedPurchaseSeatsInput').clear().type(form.seats.toString());
    }

    // while this will not work if the caller passes in an object
    // that has member equality but not reference equality, this is
    // good enough for the limited usage this function has
    if (form === defaultSuccessForm) {
        cy.contains('Upgrade').should('be.enabled');
    }

    return cy.contains('Upgrade');
}

function assertLine(lines: string[], key: string, value: string) {
    const line = lines.find((line) => line.includes(key));
    if (!line) {
        throw new Error('Expected license to show start date line but did not');
    }
    if (!line.includes(value)) {
        throw new Error(`Expected license ${key} of ${value}, but got ${line}`);
    }
}

function getCurrentUsers(): Cypress.Chainable<number> {
    return cy.request('/api/v4/analytics/old?name=standard&team_id=').then((response) => {
        const userCount = response.body.find((row: Cypress.AnalyticsRow) => row.name === 'unique_user_count');
        return userCount.value;
    });
}

describe('Self hosted Purchase', () => {
    let adminUser: UserProfile;

    beforeEach(() => {
        // prevent failed tests from bleeding over
        window.localStorage.removeItem('PURCHASE_IN_PROGRESS');
    });

    before(() => {
        cy.apiInitSetup().then(() => {
            cy.apiAdminLogin().then(({user}) => {
                // assertion because current typings are wrong.
                adminUser = user;
                cy.apiDeleteLicense();
                cy.visit('/');

                // in case there is lingering state from a prior local run or some other
                // failed test, we clear it out
                cy.request({
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                    url: '/api/v4/hosted_customer/bootstrap',
                    method: 'POST',
                    qs: {
                        reset: true,
                    },
                });
            });
        });
    });

    it('happy path, can purchase a license and have it applied automatically', () => {
        cy.apiAdminLogin();
        cy.apiDeleteLicense();

        cy.intercept('GET', '**/api/v4/hosted_customer/signup_available').as('airGappedCheck');
        cy.intercept('GET', 'https://js.stripe.com/v3').as('stripeCheck');
        cy.intercept('GET', '**/api/v4/cloud/products/selfhosted').as('products');

        // # Open pricing modal
        cy.get('#UpgradeButton').should('exist').click();

        cy.wait('@airGappedCheck');
        cy.wait('@stripeCheck');

        // The waits for these fetches is usually enough. Add a little wait
        // for all the selectors to be updated and rerenders to happen
        // so that we do not accidentally hit the air-gapped modal
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(50);

        // # Click the upgrade button to open the modal
        cy.get('#professional_action').should('exist').click();

        // * Verify basic purchase elements are available
        verifyPurchaseModal();

        // # fill out purchase form
        fillForm(defaultSuccessForm, getCurrentUsers());

        // # Wait explicitly for purchase to occur because it takes so long.
        cy.intercept('POST', '**/api/v4/hosted_customer/customer').as('createCustomer');
        cy.intercept('POST', '**/api/v4/hosted_customer/confirm').as('purchaseLicense');

        cy.contains('Upgrade').click();

        cy.wait('@createCustomer');

        // The purchase endpoint is a long once. The server itself waits two minutes.
        // Waiting a little longer ensures we don't give up on the server when it
        // succeeds (albeit slowly)
        cy.wait('@purchaseLicense', {responseTimeout: TIMEOUTS.TWO_MIN + TIMEOUTS.ONE_HUNDRED_MILLIS});

        // * Verify license was applied
        cy.contains('Your Professional license has now been applied.');

        // # Close modal
        cy.contains('Close').click();

        const today = new Date().toLocaleString().split(/\D/).slice(0, 3).join('/');
        const expiresDate = new Date(Date.now() + (366 * 24 * 60 * 60 * 1000)).toLocaleString().split(/\D/).slice(0, 3).join('/');
        const todayPadded = new Date().toLocaleString().split(/\D/).slice(0, 3).map((num) => num.padStart(2, '0')).join('/');

        // # Visit Edition and License page
        cy.visit('/admin_console/about/license');

        // * Verify information on the new purchased license

        cy.contains('Edition and License');
        cy.contains('Mattermost Professional');

        // need to wait for all data to load in, so you don't get flaky
        // asserts over still not filled in items
        cy.wait(TIMEOUTS.ONE_SEC);
        cy.findByTestId('EnterpriseEditionLeftPanel').
            get('.item-element').
            then(($els) => Cypress._.map($els, 'innerText')).
            then((lines) => {
                assertLine(lines, 'START DATE', today);
                assertLine(lines, 'EXPIRES', expiresDate);

                getCurrentUsers().then((userCount) => {
                    // * Verify user input of extra seats was honored
                    assertLine(lines, 'USERS', (userCount + additionalSeatsToPurchase).toString());
                    assertLine(lines, 'ACTIVE USERS', userCount.toString());
                });
                assertLine(lines, 'EDITION', 'Mattermost Professional');
                assertLine(lines, 'ISSUED', today);

                assertLine(lines, 'NAME', adminUser.first_name + ' ' + adminUser.last_name);
                assertLine(lines, 'COMPANY / ORG', defaultSuccessForm.org);
            });

        // # Visit invoices page
        cy.visit('/admin_console/billing/billing_history');

        // * Ensure we are not redirected
        cy.contains('Billing History');

        // * Ensure summary values are correct
        cy.contains(todayPadded);
        cy.contains('Self-Hosted Professional');

        // eslint-disable-next-line new-cap
        const dollarUSLocale = Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', minimumFractionDigits: 2});

        // * Verify payment matches what the user was told they would pay
        getCurrentUsers().then((userCount) => {
            cy.contains(`${userCount + additionalSeatsToPurchase} users`);
            cy.wait('@products').then((res) => {
                const product = res.response.body.find((product: Cypress.Product) => product.sku === 'professional');
                const purchaseAmount = dollarUSLocale.format((userCount + additionalSeatsToPurchase) * (product).price_per_seat * 12);
                cy.contains(purchaseAmount);
            });
        });
        cy.contains('Paid');

        // * Check the content from the downloaded pdf file
        cy.get('.BillingHistory__table-invoice >a').then((link) => {
            cy.request({
                url: link.prop('href'),
                encoding: 'binary',
            }).then(
                (response) => {
                    const fileName = 'self-hosted-purchase-invoice';
                    const filePath = Cypress.config('downloadsFolder') + '/' + fileName + '.pdf';
                    cy.writeFile(filePath, response.body, 'binary');
                    cy.task('getPdfContent', filePath).then((data) => {
                        const allLines = (data as {text: string}).text.split('\n');
                        const prodLine = allLines.filter((line) => line.includes('Self-Hosted Professional'));
                        expect(prodLine.length).to.be.equal(1);
                        getCurrentUsers().then((userCount) => {
                            cy.wait('@products').then((res) => {
                                const product = res.response.body.find((product: Cypress.Product) => product.sku === 'professional');
                                const purchaseAmount = dollarUSLocale.format((userCount + additionalSeatsToPurchase) * (product).price_per_seat * 12);
                                const amountLine = allLines.find((line: string) => line.includes('Amount paid'));
                                if (!amountLine.includes(purchaseAmount)) {
                                    throw new Error(`Expected purchase amount ${purchaseAmount}, but amount line was ${amountLine}`);
                                }
                            });
                        });
                    });
                },
            );
        });

        // * Check that creating groups, a professional feature, is now available for use.
        cy.visit('/');
        cy.uiGetProductMenuButton().click();
        cy.contains('User Groups').click();
        cy.contains('Create Group').should('be.enabled');
    });

    it('must purchase a license for at least the current number of users', () => {
        cy.apiAdminLogin();
        cy.visit('/');
        cy.apiDeleteLicense();

        cy.intercept('GET', '**/api/v4/hosted_customer/signup_available').as('airGappedCheck');
        cy.intercept('GET', 'https://js.stripe.com/v3').as('stripeCheck');
        cy.intercept('GET', '**/api/v4/cloud/products/selfhosted').as('products');

        // # Open pricing modal
        cy.get('#UpgradeButton').should('exist').click();

        cy.wait('@airGappedCheck');
        cy.wait('@stripeCheck');
        cy.wait('@products');

        // The waits for these fetches is usually enough. Add a little wait
        // for all the selectors to be updated and rerenders to happen
        // so that we do not accidentally hit the air-gapped modal
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(50);

        // # Click the upgrade button to open the modal
        cy.get('#professional_action').should('exist').click();

        // * Verify basic purchase elements are available
        verifyPurchaseModal();

        // # Fill form with too low of a number of seats
        fillForm({...defaultSuccessForm, seats: 1}, getCurrentUsers());

        getCurrentUsers().then((currentUsers) => {
            // * Verify form can not be submitted
            cy.contains(`Your workspace currently has ${currentUsers} users`).should('not.be.enabled');
            cy.contains('Upgrade').should('not.be.enabled');

            // # Fill form the same number of seats as current users
            cy.findByTestId('selfHostedPurchaseSeatsInput').clear().type(currentUsers.toString());
        });

        // * Verify form can be submitted
        cy.contains('Upgrade').should('be.enabled');

        // # Close purchase flow, as otherwise you will get a purchase in progress error
        cy.get('#closeIcon').click();
    });

    it('failed payment in stripe means no license is received', () => {
        cy.apiAdminLogin();
        cy.visit('/');
        cy.apiDeleteLicense();

        cy.intercept('GET', '**/api/v4/hosted_customer/signup_available').as('airGappedCheck');
        cy.intercept('GET', 'https://js.stripe.com/v3').as('stripeCheck');
        cy.intercept('GET', '**/api/v4/cloud/products/selfhosted').as('products');

        // # Open pricing modal
        cy.get('#UpgradeButton').should('exist').click();

        cy.wait('@airGappedCheck');
        cy.wait('@stripeCheck');
        cy.wait('@products');

        // The waits for these fetches is usually enough. Add a little wait
        // for all the selectors to be updated and rerenders to happen
        // so that we do not accidentally hit the air-gapped modal
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(50);

        // # Click the upgrade button to open the modal
        cy.get('#professional_action').should('exist').click();

        // * Verify basic purchase elements are available
        verifyPurchaseModal();

        // # Fill form with a known failing card
        fillForm({...defaultSuccessForm, card: failCardNumber}, getCurrentUsers());

        // # Wait explicitly for parts of the purchase because they can take long.
        cy.intercept('POST', '**/api/v4/hosted_customer/customer').as('createCustomer');

        cy.contains('Upgrade').should('be.enabled').click();

        cy.wait('@createCustomer');

        // # Verify failure screen presented
        cy.contains('Sorry, the payment verification failed');
        cy.contains('Try again');
        cy.contains('Contact Support');

        // # Close purchase flow
        cy.get('#closeIcon').click();

        // # Go to license page
        cy.visit('/admin_console/about/license');

        // * Verify no license was applied
        cy.contains('Upgrade to the Professional Plan');
        cy.contains('Purchase');
    });

    it('customer in region banned from purchase is not able to purchase and is told their transaction is under review.', () => {
        // this test must run last within this suite because it sets a value in the DB that prevents further purchase for 3 days.
        // For now, we do not have a programmatic way to reset this.
        // So if you are running locally you need to log into the DB and run
        // DELETE FROM systems where name = 'HostedPurchaseNeedsScreening';

        cy.apiAdminLogin();
        cy.visit('/');
        cy.apiDeleteLicense();

        cy.intercept('GET', '**/api/v4/hosted_customer/signup_available').as('airGappedCheck');
        cy.intercept('GET', '**/api/v4/cloud/products/selfhosted').as('products');

        // # Open pricing modal
        cy.get('#UpgradeButton').should('exist').click();

        cy.wait('@airGappedCheck');
        cy.wait('@products');

        // The waits for these fetches is usually enough. Add a little wait
        // for all the selectors to be updated and rerenders to happen
        // so that we do not accidentally hit the air-gapped modal
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(50);

        // # Click the upgrade button to open the modal
        cy.get('#professional_action').should('exist').click();

        // * Verify basic purchase elements are available
        verifyPurchaseModal();

        // # Fill form with a known screened region
        fillForm({...defaultSuccessForm, country: 'Iran, Islamic Republic of'}, getCurrentUsers());

        // # Wait explicitly for parts of the purchase because they can take long.
        cy.intercept('POST', '**/api/v4/hosted_customer/customer').as('createCustomer');

        cy.contains('Upgrade').should('be.enabled').click();

        cy.wait('@createCustomer');

        // * Verify screening in progress UI presented
        cy.contains('Your transaction is being reviewed');
        cy.contains('We will check things on our side and get back to you');

        // # Close purchase flow
        cy.get('#closeIcon').click();

        // # attempt to re-open purchase flow
        cy.get('#UpgradeButton').should('exist').click();
        cy.wait('@airGappedCheck');
        cy.wait('@products');
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(50);

        // # Click the upgrade button to open the modal
        cy.get('#professional_action').should('exist').click();

        // * Verify screening in progress UI presented
        cy.contains('Your transaction is being reviewed');
        cy.contains('We will check things on our side and get back to you');
    });
});
