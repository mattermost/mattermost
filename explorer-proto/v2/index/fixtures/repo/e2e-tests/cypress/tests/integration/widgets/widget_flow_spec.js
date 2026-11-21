// Stage: @prod
// Group: @widgets @widget_flow

import {verifyBanner} from '@/utils';

function openPanelFor(name) {
    cy.uiOpenWidgetMenu(name);
    nestedPanelCheck();
}

function nestedPanelCheck() {
    cy.get('#nestedPanel').should('exist');
}

describe('Widget flow', () => {
    let owner;
    let other;

    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(({user}) => {
            owner = user;
        });
        cy.apiCreateUser().then(({user}) => {
            other = user;
        });
    });

    beforeEach(() => {
        cy.visit('/widgets/home');
    });

    it('MM-T9001 opens the widget menu and checks the banner', () => {
        // # Open the menu for Delta
        cy.uiOpenWidgetMenu('Delta');

        // # Click the beta button and the gamma text
        cy.findByRole('button', {name: 'Beta'}).click();
        cy.contains('Gamma text').click();

        // * Banner is shown
        verifyBanner('Welcome');
        cy.get('#alphaBtn').should('be.visible');
        cy.url().should('include', '/widgets');
    });

    it('MM-T9002 second actor posts and the owner sees it', () => {
        cy.postMessageAs({sender: other, message: 'hello widget', channelId: 'c1'});
        cy.apiLogin(owner);
        cy.uiGetWidgetPanel().findByText('hello widget').should('be.visible');
        cy.get('#widgetPanel').find('.row').first().should('contain', 'hello widget');
    });

    it('MM-T9003 uses a nested helper', () => {
        openPanelFor('Epsilon');
        cy.get('#rowAfter').click();
    });

    it.skip('MM-T9004 skipped test', () => {
        cy.get('#neverRuns').click();
    });

    it('MM-T9005 builds a template locator with a static prefix', () => {
        const id = 'abc123';
        cy.get(`#row_${id}`).click();
        cy.get(`#${id}`).click();
    });

    it('MM-T9006 uses an unknown command', () => {
        cy.mysteryCommand('x');
        cy.get('#after').click();
    });
});
