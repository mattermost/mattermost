Cypress.Commands.add('uiOpenWidgetMenu', (item = '') => {
    cy.get('#widgetHeader').click();
    if (item) {
        cy.findByText(item).click();
    }
    cy.get('#widgetMenu').should('be.visible');
});

Cypress.Commands.add('uiGetWidgetPanel', () => {
    return cy.get('#widgetPanel').should('be.visible');
});

Cypress.Commands.add('apiMakeWidget', (name) => {
    return cy.request({method: 'POST', url: '/api/widgets', body: {name}});
});
