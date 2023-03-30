// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @cloud_only @cloud_trial

import * as TIMEOUTS from '../../../../../fixtures/timeouts';
import billing from '../../../../../fixtures/client_billing.json';

describe('System Console - after subscription scenarios', () => {
    before(() => {
        // * Check if server has license for Cloud
        cy.apiRequireLicenseForFeature('Cloud');

        // # Visit Subscription page
        cy.visit('/admin_console/billing/subscription');

        // * Check for Subscription header
        cy.contains('.admin-console__header', 'Subscription').should('be.visible');

        // # Click Subscribe Now button
        cy.contains('span', 'Upgrade Now').parent().click();

        cy.intercept('POST', '/api/v4/cloud/payment/confirm').as('confirm');

        cy.intercept('GET', '/api/v4/cloud/subscription').as('subscribe');

        // # Enter card details
        cy.uiGetPaymentCardInput().within(() => {
            cy.get('[name="cardnumber"]').should('be.enabled').clear().type(billing.visa.cardNumber);
            cy.get('[name="exp-date"]').should('be.enabled').clear().type(billing.visa.expDate);
            cy.get('[name="cvc"]').should('be.enabled').clear().type(billing.visa.cvc);
        });
        cy.get('#input_name').clear().type('test name');
        cy.findByText('Country').parent().find('.icon-chevron-down').click();
        cy.findByText('Country').parent().find("input[type='text']").type('India{enter}', {force: true});
        cy.get('#input_address').clear().type('testaddress');
        cy.get('#input_city').clear().type('testcity');
        cy.get('#input_state').clear().type('teststate');
        cy.get('#input_postalCode').clear().type('4444');

        // # Click Subscribe button
        cy.get('.RHS').find('button').last().should('be.enabled').click();

        cy.wait(['@confirm', '@subscribe']);

        // * Check for success message
        cy.findByText('You are now subscribed to Cloud Professional', {timeout: TIMEOUTS.TEN_SEC}).should('be.visible');

        // # Click Let's go! button
        cy.get('#payment_complete_header').find('button').should('be.enabled').click();

        // * Check for non existence of 'Your trial has started!' in banner message
        cy.contains('span', 'Your trial has started!').should('not.exist');

        // * Check for non existence of 'Subscribe now' button in banner message
        cy.contains('span', 'Upgrade Now').parent().should('not.exist');
    });

    describe('System Console - Subscription section', () => {
        it('MM-T4134 Downloading of invoice after subscription', () => {
            navigateToBillingScreen('#billing\\/subscription', 'Subscription');

            cy.get('.BillingSummary__lastInvoice-productName').invoke('text').as('productName');

            cy.get('.BillingSummary__lastInvoice-chargeAmount').invoke('text').as('totalCharge');

            // * Check the content from the downloaded pdf file
            cy.get('.BillingSummary__lastInvoice-download >a').then((link) => {
                cy.request({
                    url: link.prop('href'),
                    encoding: 'binary',
                }).then(
                    (response) => {
                        const fileName = 'subscriptioninvoice';
                        const filePath = Cypress.config('downloadsFolder') + '/' + fileName + '.pdf';
                        cy.writeFile(filePath, response.body, 'binary');
                        cy.task('getPdfContent', filePath).then((data) => {
                            const allLines = data.text.split('\n');
                            const prodLine = allLines.filter((line) => line.includes('Trial period for Cloud Free'));
                            expect(prodLine.length).to.be.equal(1);
                            const amountLine = allLines.filter((line) => line.includes('Amount paid'));
                            expect(amountLine[0].includes('$0.00')).to.be.equal(true);
                        });
                    },
                );
            });
        });
    });
    describe('System Console - Payment Information section', () => {
        it('MM-T4167 check for the card details in payment info screen', () => {
            navigateToBillingScreen('#billing\\/payment_info', 'Payment Information');

            // * Check for last four digit of card and Expire date
            cy.get('.PaymentInfoDisplay__paymentInfo-cardInfo').within(() => {
                cy.get('span').eq(0).should('have.text', 'visa ending in 4242');
                cy.get('span').eq(1).should('have.text', 'Expires 04/2024');
            });

            // * Check for address details
            cy.get('.PaymentInfoDisplay__paymentInfo-address').within(() => {
                cy.get('div').eq(0).should('have.text', 'testaddress');
                cy.get('div').eq(1).should('have.text', 'testcity, teststate, 4444');
                cy.get('div').eq(2).should('have.text', 'IO');
            });
        });

        it('MM-T4169 Check for see billing link navigation in edit payment info', () => {
            navigateToBillingScreen('#billing\\/payment_info', 'Payment Information');

            // # Click edit button
            cy.get('.PaymentInfoDisplay__paymentInfo-editButton').click();

            // * Check for See how billing works navigation
            cy.contains('span', 'See how billing works').parent().then((link) => {
                const getHref = () => link.prop('href');
                cy.wrap({href: getHref}).invoke('href').should('contains', '/cloud-billing.html');
                cy.wrap(link).should('have.attr', 'target', '_new');
                cy.wrap(link).should('have.attr', 'rel', 'noopener noreferrer');
                cy.request(link.prop('href')).its('status').should('eq', 200);
            });
        });

        it('MM-T4170 Edit payment info', () => {
            navigateToBillingScreen('#billing\\/payment_info', 'Payment Information');

            cy.intercept('GET', '/api/v4/cloud/customer').as('customer');

            // # Click edit button
            cy.get('.PaymentInfoDisplay__paymentInfo-editButton').click();

            cy.wait('@customer');

            cy.intercept('POST', '/api/v4/cloud/payment').as('payment');

            cy.intercept('POST', '/api/v4/cloud/payment/confirm').as('confirm');

            cy.intercept('GET', '/api/v4/cloud/subscription').as('subscribe');

            // # Enter card details
            cy.uiGetPaymentCardInput().within(() => {
                cy.get('[name="cardnumber"]').should('be.enabled').clear().type(billing.mastercard.cardNumber);
                cy.get('[name="exp-date"]').should('be.enabled').clear().type(billing.mastercard.expDate);
                cy.get('[name="cvc"]').clear().should('be.enabled').type(billing.mastercard.cvc);
            });
            cy.get('#input_name').clear().type('test newname');
            cy.findByText('Country').parent().find('.icon-chevron-down').click();
            cy.findByText('Country').parent().find("input[type='text']").type('Algeria{enter}');
            cy.get('#input_address').clear().type('testnewaddress');
            cy.get('#input_city').clear().type('testnewcity');
            cy.get('#input_state').clear().type('testnewstate');
            cy.get('#input_postalCode').clear().type('3333');

            // # Click Save Credit Card button
            cy.get('#saveSetting').should('be.enabled').click();

            cy.wait(['@payment', '@confirm']);

            cy.wait('@subscribe');

            // * Check for last four digit of card and Expire date
            cy.get('.PaymentInfoDisplay__paymentInfo-cardInfo').within(() => {
                cy.get('span').eq(0).should('have.text', 'mastercard ending in 4444');
                cy.get('span').eq(1).should('have.text', 'Expires 04/2024');
            });

            // * Check for address details
            cy.get('.PaymentInfoDisplay__paymentInfo-address').within(() => {
                cy.get('div').eq(0).should('have.text', 'testnewaddress');
                cy.get('div').eq(1).should('have.text', 'testnewcity, testnewstate, 3333');
                cy.get('div').eq(2).should('have.text', 'DZ');
            });
        });

        it('MM-T4171 disable Save Credit Card button in edit payment info', () => {
            navigateToBillingScreen('#billing\\/payment_info', 'Payment Information');

            cy.intercept('GET', '/api/v4/cloud/customer').as('customer');

            // # Click edit button
            cy.get('.PaymentInfoDisplay__paymentInfo-editButton').click();

            cy.wait('@customer');

            // # Enter card details
            cy.uiGetPaymentCardInput().within(() => {
                cy.get('[name="cardnumber"]').should('be.enabled').clear().type(billing.mastercard.cardNumber);
                cy.get('[name="exp-date"]').should('be.enabled').clear().type(billing.mastercard.expDate);
                cy.get('[name="cvc"]').clear().should('be.enabled').type(billing.mastercard.cvc);
            });
            cy.get('#input_name').should('be.enabled').invoke('val', '');
            cy.findByText('Country').parent().find('.icon-chevron-down').click();
            cy.findByText('Country').parent().find("input[type='text']").should('be.enabled').type('Algeria{enter}');
            cy.get('#input_address').should('be.enabled').invoke('val', '');
            cy.get('#input_city').should('be.enabled').invoke('val', '');
            cy.get('#input_state').should('be.enabled').clear().type('testnewstate');
            cy.get('#input_postalCode').should('be.enabled').clear().type('3333');

            // * Check for disabling of Save Credit Card button
            cy.get('#saveSetting').should('not.be.enabled');

            cy.get('#input_name').should('be.enabled').clear().type('test newname');
            cy.get('#input_address').should('be.enabled').clear().type('testnewaddress');
            cy.get('#input_address').should('be.enabled').clear().type('testcity');

            // * Check for enabling of Save Credit Card button
            cy.get('#saveSetting').should('be.enabled');
        });

        it('MM-T4172 Cancelling the edit payment info', () => {
            navigateToBillingScreen('#billing\\/payment_info', 'Payment Information');

            // # Click edit button
            cy.get('.PaymentInfoDisplay__paymentInfo-editButton').click();

            // # Click edit button
            cy.get(' .admin-console__header .back').click();

            // * Check for Payment info header
            cy.contains('.admin-console__header', 'Payment Information').should('be.visible');

            // # Click edit button
            cy.get('.PaymentInfoDisplay__paymentInfo-editButton').click();

            // # Enter card details
            cy.uiGetPaymentCardInput().within(() => {
                cy.get('[name="cardnumber"]').should('be.enabled').clear().type(billing.unionpay.cardNumber);
                cy.get('[name="exp-date"]').should('be.enabled').clear().type(billing.unionpay.expDate);
                cy.get('[name="cvc"]').should('be.enabled').clear().type(billing.unionpay.cvc);
            });
            cy.get('#input_name').clear().type('test newname');
            cy.findByText('Country').parent().find('.icon-chevron-down').click();
            cy.findByText('Country').parent().find("input[type='text']").type('Albania{enter}');
            cy.get('#input_address').clear().type('testcanceladdress');
            cy.get('#input_city').clear().type('testcancelcity');
            cy.get('#input_state').clear().type('testcanceltate');
            cy.get('#input_postalCode').clear().type('2222');

            // # Click Cancel button
            cy.get('.cancel-button').click();

            // * Check for last four digit of card and Expire date
            cy.get('.PaymentInfoDisplay__paymentInfo-cardInfo').within(() => {
                cy.get('span').eq(0).should('not.have.text', 'unionpay ending in 0005');
                cy.get('span').eq(1).should('not.have.text', 'Expires 12/2012');
            });

            // * Check for address details
            cy.get('.PaymentInfoDisplay__paymentInfo-address').within(() => {
                cy.get('div').eq(0).should('not.have.text', 'testcanceladdress');
                cy.get('div').eq(1).should('not.have.text', 'testcancelcity, testcanceltate, 2222');
                cy.get('div').eq(2).should('not.have.text', 'AL');
            });
        });
    });
    describe('System Console - Company Information section', () => {
        let customerInfo = {};
        before(() => {
            cy.intercept('GET', '/api/v4/cloud/customer').as('customerInfo');
            navigateToBillingScreen('#billing\\/company_info', 'Company Information');
            cy.wait('@customerInfo').its('response.body').then((customerDetails) => {
                customerInfo = customerDetails;
            });
        });
        it('MM-T4162 Validate the Company address after subscription', () => {
            navigateToBillingScreen('#billing\\/company_info', 'Company Information');

            // * Check for persisted company name
            cy.get('.CompanyInfoDisplay__companyInfo-name').should('have.text', customerInfo.name);

            // * Check for employee number
            cy.get('.CompanyInfoDisplay__companyInfo-numEmployees > span').should('include.text', customerInfo.num_employees);

            // * Check for address details
            cy.get('.CompanyInfoDisplay__companyInfo-address').within(() => {
                cy.get('div').eq(0).should('have.text', customerInfo.billing_address.line1);
                if (customerInfo.billing_address.line2 !== '') {
                    cy.get('div').eq(1).should('have.text', `${customerInfo.billing_address.line2}`);
                    cy.get('div').eq(2).should('have.text', `${customerInfo.billing_address.city}, ${customerInfo.billing_address.state}, ${customerInfo.billing_address.postal_code}`);
                    cy.get('div').eq(3).should('have.text', customerInfo.billing_address.country);
                } else if (customerInfo.billing_address.line2 === '') {
                    cy.get('div').eq(1).should('have.text', `${customerInfo.billing_address.city}, ${customerInfo.billing_address.state}, ${customerInfo.billing_address.postal_code}`);
                    cy.get('div').eq(2).should('have.text', customerInfo.billing_address.country);
                }
            });
        });

        it('MM-T4165 Editing billing address of the company after subscription', () => {
            navigateToBillingScreen('#billing\\/company_info', 'Company Information');

            cy.get('.CompanyInfoDisplay__companyInfo-editButton').click();

            // * Check name of the company
            cy.get('#input_companyName').should('have.value', customerInfo.name);

            // * Check the no of employees
            cy.get('#input_numEmployees').should('have.value', customerInfo.num_employees);

            // # Enter the company info
            cy.get('#input_companyName').clear().type('test company name');
            cy.get('#input_numEmployees').clear().type('1000');
            cy.findByText('Same as Billing Address').prev().should('be.checked').click().should('not.be.checked');
            cy.contains('legend', 'Country').parent().find('.icon-chevron-down').click();
            cy.contains('legend', 'Country').parent().find("input[type='text']").type('India{enter}');
            cy.get('#input_address').type('testcompanyaddress');
            cy.get('#input_address2').type('testcompanyaddress2');
            cy.get('#input_city').clear().type('testcompanycity');
            cy.get('#input_state').type('testcompnaystate');
            cy.get('#input_postalCode').type('5555');

            // # Click Save Info button
            cy.get('#saveSetting').should('be.enabled').click();

            // * Check name of the company after editing it
            cy.get('.CompanyInfoDisplay__companyInfo-name').should('have.text', 'test company name');

            // * Check for employee number
            cy.get('.CompanyInfoDisplay__companyInfo-numEmployees > span').should('include.text', '1000');

            // * Check for address details
            cy.get('.CompanyInfoDisplay__companyInfo-address').within(() => {
                cy.get('div').eq(0).should('have.text', 'testcompanyaddress');
                cy.get('div').eq(1).should('have.text', 'testcompanyaddress2');
                cy.get('div').eq(2).should('have.text', 'testcompanycity, testcompnaystate, 5555');
                cy.get('div').eq(3).should('have.text', 'IO');
            });

            // # Click on edit company info button again
            cy.get('.CompanyInfoDisplay__companyInfo-editButton').click();

            // * Check for edited company Info
            cy.get('#input_companyName').should('have.value', 'test company name');
            cy.get('#input_numEmployees').should('have.value', '1000');
            cy.contains('British Indian Ocean Territory').should('exist');
            cy.get('#input_address').should('have.value', 'testcompanyaddress');
            cy.get('#input_address2').should('have.value', 'testcompanyaddress2');
            cy.get('#input_city').should('have.value', 'testcompanycity');
            cy.get('#input_state').should('have.value', 'testcompnaystate');
            cy.get('#input_postalCode').should('have.value', '5555');

            // # Enter the company name and no of employees
            cy.get('#input_companyName').clear().type('test company');
            cy.get('#input_numEmployees').clear().type('100');

            // # Click to uncheck the 'Same as Billing Address' checkbox
            cy.findByText('Same as Billing Address').prev().should('not.be.checked').click().should('be.checked');

            // # Click Save Info button
            cy.get('#saveSetting').should('be.enabled').click();

            // * Check for address details
            cy.get('.CompanyInfoDisplay__companyInfo-address').within(() => {
                cy.get('div').eq(0).should('have.text', customerInfo.billing_address.line1);
                if (customerInfo.billing_address.line2 !== '') {
                    cy.get('div').eq(1).should('have.text', `${customerInfo.billing_address.line2}`);
                    cy.get('div').eq(2).should('have.text', `${customerInfo.billing_address.city}, ${customerInfo.billing_address.state}, ${customerInfo.billing_address.postal_code}`);
                    cy.get('div').eq(3).should('have.text', customerInfo.billing_address.country);
                } else if (customerInfo.billing_address.line2 === '') {
                    cy.get('div').eq(1).should('have.text', `${customerInfo.billing_address.city}, ${customerInfo.billing_address.state}, ${customerInfo.billing_address.postal_code}`);
                    cy.get('div').eq(2).should('have.text', customerInfo.billing_address.country);
                }
            });
        });
    });
});

// # navigate to billing screens
const navigateToBillingScreen = (linkLocator, headerName) => {
    cy.get(linkLocator).scrollIntoView().should('be.visible').click();
    cy.contains('.admin-console__header', headerName).should('be.visible');
};
