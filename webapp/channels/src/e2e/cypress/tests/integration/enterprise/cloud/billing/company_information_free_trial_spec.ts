// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @cloud_only @cloud_trial

import {getRandomLetter} from '../../../../utils/index';

describe('System Console - Company Information section', () => {
    before(() => {
        // * Check if server has license for Cloud
        cy.apiRequireLicenseForFeature('Cloud');

        // # Visit Company Information page
        cy.visit('/admin_console/billing/company_info');

        // * Check for the Company Information header
        cy.contains('.admin-console__header', 'Company Information').should('be.visible');
    });

    beforeEach(() => {
        // # Click on cancel button if exist
        cy.get('body').then(($body) => {
            if ($body.find('.cancel-button').length > 0) {
                cy.get('.cancel-button').click();
                cy.get('#confirmModalButton').click();
            }
        });
    });

    it('MM-T4164 Save Info button should not be enabled if any one of the mandatory field is filled with invalid data', () => {
        const companyName = getRandomLetter(30);

        // # Click on Add Company Information button
        cy.contains('span', 'Company Information').parent().click();
        cy.get('.CompanyInfoDisplay__companyInfo-editButton').click();

        // # Enter valid company information
        cy.get('#input_companyName').clear().type(companyName);
        cy.get('#input_numEmployees').clear().type('10');
        cy.get('#DropdownInput_country_dropdown').click();
        cy.get("#DropdownInput_country_dropdown .DropDown__input > input[type='text']").type('India{enter}');
        cy.get('#input_address').clear().type('test address');
        cy.get('#input_address2').clear().type('test2');
        cy.get('#input_city').clear().type('testcity');
        cy.get('#input_state').clear().type('test');
        cy.get('#input_postalCode').clear().type('44455');

        // * Check save button is enabled
        cy.get('#saveSetting').should('be.enabled');

        // # Clear postal code
        cy.get('#input_postalCode').clear();

        // * Check save button is disabled
        cy.get('#saveSetting').should('be.disabled');

        // # Type valid postal code
        cy.get('#input_postalCode').type('44456');

        // * Check save button is enabled
        cy.get('#saveSetting').should('be.enabled');

        // # Clear city
        cy.get('#input_city').clear();

        // * Check save button is disabled
        cy.get('#saveSetting').should('be.disabled');

        // # Type valid city
        cy.get('#input_city').type('testcity');

        // * Check save button is  enabled
        cy.get('#saveSetting').should('be.enabled');

        // # Clear company name
        cy.get('#input_companyName').clear();

        // * Check save button is disabled
        cy.get('#saveSetting').should('be.disabled');
    });

    it('MM-T4161 Adding the Company Information', () => {
        const companyName = getRandomLetter(30);

        // # Click on Add Company Information button
        cy.contains('span', 'Company Information').parent().click();
        cy.get('.CompanyInfoDisplay__companyInfo-editButton').click();

        // # Enter company information
        cy.get('#input_companyName').clear().type(companyName);
        cy.get('#input_numEmployees').clear().type('10');
        cy.get('#DropdownInput_country_dropdown').click();
        cy.get("#DropdownInput_country_dropdown .DropDown__input > input[type='text']").type('India{enter}');
        cy.get('#input_address').clear().type('Add test address');
        cy.get('#input_address2').clear().type('Add test address2');
        cy.get('#input_city').clear().type('Addtestcity');
        cy.get('#input_state').clear().type('Addteststate');
        cy.get('#input_postalCode').clear().type('560089');

        // # Click on Save Info button
        cy.get('#saveSetting').should('be.enabled').click();

        // * Check for persisted company name
        cy.get('.CompanyInfoDisplay__companyInfo-name').should('have.text', companyName);

        // * Check for employee number
        cy.get('.CompanyInfoDisplay__companyInfo-numEmployees > span').should('include.text', '10');

        // * Check for country
        cy.get('.CompanyInfoDisplay__companyInfo-address > div').eq(3).should('have.text', 'British Indian Ocean Territory');

        // * Check for city, state and postal code
        cy.get('.CompanyInfoDisplay__companyInfo-address > div').eq(2).should('have.text', 'Addtestcity, Addteststate, 560089');

        // * Check for address 2
        cy.get('.CompanyInfoDisplay__companyInfo-address > div').eq(1).should('have.text', 'Add test address2');

        // * Check for address 1
        cy.get('.CompanyInfoDisplay__companyInfo-address > div').eq(0).should('have.text', 'Add test address');
    });

    it('MM-T4165 Editing the Company Information', () => {
        const companyName = getRandomLetter(30);

        // # Click on edit Company Information button
        cy.get('.CompanyInfoDisplay__companyInfo-editButton').click();

        // # Enter company information
        cy.get('#input_companyName').clear().type(companyName);
        cy.get('#input_numEmployees').clear().type('10');
        cy.get('#DropdownInput_country_dropdown').click();
        cy.get("#DropdownInput_country_dropdown .DropDown__input > input[type='text']").type('India{enter}');
        cy.get('#input_address').clear().type('test address');
        cy.get('#input_address2').clear().type('test2');
        cy.get('#input_city').clear().type('testcity');
        cy.get('#input_state').clear().type('test');
        cy.get('#input_postalCode').clear().type('44455');

        // # Click on Save Info button
        cy.get('#saveSetting').should('be.enabled').click();

        // * Check for persisted company name
        cy.get('.CompanyInfoDisplay__companyInfo-name').should('have.text', companyName);

        // * Check for employee number
        cy.get('.CompanyInfoDisplay__companyInfo-numEmployees > span').should('include.text', '10');

        // * Check for country
        cy.get('.CompanyInfoDisplay__companyInfo-address > div').eq(3).should('have.text', 'British Indian Ocean Territory');

        // * Check for city, state and postal code
        cy.get('.CompanyInfoDisplay__companyInfo-address > div').eq(2).should('have.text', 'testcity, test, 44455');

        // * Check for address 2
        cy.get('.CompanyInfoDisplay__companyInfo-address > div').eq(1).should('have.text', 'test2');

        // * Check for address 1
        cy.get('.CompanyInfoDisplay__companyInfo-address > div').eq(0).should('have.text', 'test address');
    });

    it('MM-T4166 Cancelling of editing of company information details', () => {
        // # Click Add edit Information button
        cy.get('.CompanyInfoDisplay__companyInfo-editButton').click();

        // # Click back button of Edit Company Information
        cy.contains('span', 'Edit Company Information').prev().click();

        // * Check for back functionality using back button of edit company information screen
        cy.get('.CompanyInfoDisplay__companyInfo-editButton').should('be.visible');

        // # Click Add Company Information button
        cy.get('.CompanyInfoDisplay__companyInfo-editButton').click();

        // # Enter company information
        cy.get('#input_companyName').clear().type('CancelcompanyName');
        cy.get('#input_numEmployees').clear().type('11');
        cy.get('#DropdownInput_country_dropdown').click();
        cy.get("#DropdownInput_country_dropdown .DropDown__input > input[type='text']").type('Albania{enter}');
        cy.get('#input_address').clear().type('canceltest address');
        cy.get('#input_address2').clear().type('canceltest2');
        cy.get('#input_city').clear().type('canceltestcity');
        cy.get('#input_state').clear().type('canceltest');
        cy.get('#input_postalCode').clear().type('560072');

        // # Click cancel button
        cy.get('.cancel-button').click();

        // * Check for visibility of Add Company Information button
        cy.get('.CompanyInfoDisplay__companyInfo-editButton').should('be.visible');

        // * Check for persisted company name
        cy.get('.CompanyInfoDisplay__companyInfo-name').should('not.have.text', 'CancelcompanyName');

        // * Check for employee number
        cy.get('.CompanyInfoDisplay__companyInfo-numEmployees > span').should('not.include.text', '11');

        // * Check for country
        cy.get('.CompanyInfoDisplay__companyInfo-address > div').eq(3).should('not.have.text', 'Albania');

        // * Check for city, state and postal code
        cy.get('.CompanyInfoDisplay__companyInfo-address > div').eq(2).should('not.have.text', 'canceltestcity, canceltest, 560072');

        // * Check for address 2
        cy.get('.CompanyInfoDisplay__companyInfo-address > div').eq(1).should('not.have.text', 'canceltest2');

        // * Check for address 1
        cy.get('.CompanyInfoDisplay__companyInfo-address > div').eq(0).should('not.have.text', 'canceltest address');
    });
});

