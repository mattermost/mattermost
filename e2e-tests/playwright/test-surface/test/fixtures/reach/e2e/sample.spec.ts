// e2e code the stale-reference check reads (not part of the scanned app)
declare const page: {getByTestId: (id: string | RegExp) => unknown; locator: (s: string) => unknown};

page.getByTestId('live.row');
page.getByTestId('live.renamed_row');
page.locator('[data-testid^="lazy.label"]');
page.getByTestId(/^lazy\.label--text$/);
page.getByTestId('computed-at-runtime');
const scope = 'lazy';
page.getByTestId(`${scope}.chip:0`);

// Cypress (with Testing Library's commands): its queries are checked too
declare const cy: {findByTestId: (id: string) => unknown; findAllByTestId: (id: string) => unknown; get: (s: string) => unknown};
cy.findByTestId('live.row');
cy.findAllByTestId('cypress.renamed_row');
cy.get('[data-testid="live.row"]');
