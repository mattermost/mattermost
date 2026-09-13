// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="cypress" />

declare namespace Cypress {
    interface Chainable {

        /**
         * Reload the page, same as cy.reload but extended with explicit wait to allow page to load freely
         * @param forceReload — Whether to reload the current page without using the cache. true forces the reload without cache.
         * @param options — Pass in an options object to change the default behavior of cy.reload()
         * @param duration — wait duration with 3 seconds by default
         *
         * @example
         *   cy.reload();
         */
        reload(forceReload: boolean, options?: Partial<Loggable & Timeoutable>, duration?: number): Chainable;

        /**
         * Visit the given url, same as cy.visit but extended with explicit wait to allow page to load freely
         * @param url — The URL to visit. If relative uses baseUrl
         * @param options — Pass in an options object to change the default behavior of cy.visit()
         * @param duration — wait duration with 3 seconds by default
         *
         * @example
         *   cy.visit('url');
         */
        visit(url: string, options?: Partial<Cypress.VisitOptions>, duration?: number): Chainable;

        /**
         * types the given string with `TypeOption.force` set to true
         *
         * @param text - the string that should be force-typed
         * @param [options] - optional TypeOptions object (`force` option is omitted because it is manually set on the command)
         *
         * @example
         *   cy.get('#emailInput').typeWithForce('john.doe@example.com');
         */
        typeWithForce(text: string, options?: Omit<Partial<TypeOptions>, 'force'>): Chainable;
    }
}
