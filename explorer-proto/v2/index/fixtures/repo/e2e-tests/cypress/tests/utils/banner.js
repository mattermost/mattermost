export function verifyBanner(text) {
    cy.get('#bannerRoot').should('contain', text);
}
