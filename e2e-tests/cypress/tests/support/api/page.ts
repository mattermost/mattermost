// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChainableT} from 'tests/types';

import {getRandomId} from '../../utils';

// *****************************************************************************
// Pages
// https://api.mattermost.com/#tag/pages
// *****************************************************************************

/**
 * Create a wiki for a channel.
 * @param {string} channelId - The channel ID
 * @param {string} title - Wiki title
 * @param {string} description - Wiki description (optional)
 * @returns {any} `out.wiki` as wiki object
 *
 * @example
 *   cy.apiCreateWiki(channelId, 'Test Wiki').then(({wiki}) => {
 *       // do something with wiki
 *   });
 */
function apiCreateWiki(channelId: string, title: string, description = ''): ChainableT<{wiki: any}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/wikis',
        method: 'POST',
        body: {
            channel_id: channelId,
            title,
            description,
        },
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({wiki: response.body});
    });
}

Cypress.Commands.add('apiCreateWiki', apiCreateWiki);

/**
 * Create a new page in a wiki.
 * @param {string} wikiId - The wiki ID
 * @param {string} title - Page title
 * @param {string} content - Page content (TipTap JSON string)
 * @param {string} pageParentId - Parent page ID (optional, empty string for root pages)
 * @returns {any} `out.page` as page object
 *
 * @example
 *   cy.apiCreatePage(wikiId, 'Test Page', '{"type":"doc","content":[]}').then(({page}) => {
 *       // do something with page
 *   });
 */
function apiCreatePage(wikiId: string, title: string, content: string, pageParentId = ''): ChainableT<{page: any}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/wikis/${wikiId}/pages`,
        method: 'POST',
        body: {
            title,
            content,
            page_parent_id: pageParentId,
        },
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({page: response.body});
    });
}

Cypress.Commands.add('apiCreatePage', apiCreatePage);

/**
 * Create a hierarchy of pages for testing.
 * Creates a root page and multiple child pages.
 * @param {string} wikiId - The wiki ID
 * @param {number} depth - Number of levels (default: 2)
 * @param {number} childrenPerLevel - Number of children per parent (default: 3)
 * @returns {any} `out.pages` as array of page objects, `out.rootPage` as root page
 *
 * @example
 *   cy.apiCreatePageHierarchy(wikiId, 3, 2).then(({pages, rootPage}) => {
 *       // pages contains all created pages
 *       // rootPage is the top-level page
 *   });
 */
function apiCreatePageHierarchy(
    wikiId: string,
    depth = 2,
    childrenPerLevel = 3,
): ChainableT<{pages: any[]; rootPage: any}> {
    const defaultContent = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test content"}]}]}';
    const pages: any[] = [];

    // Create root page
    return cy.apiCreatePage(wikiId, `Root Page ${getRandomId()}`, defaultContent).then(({page: rootPage}) => {
        pages.push(rootPage);

        if (depth <= 1) {
            return cy.wrap({pages, rootPage});
        }

        // Create child pages recursively
        const createChildren = (parentId: string, currentDepth: number, childIndex: number): Cypress.Chainable<any> => {
            if (currentDepth >= depth) {
                return cy.wrap(null);
            }

            if (childIndex >= childrenPerLevel) {
                return cy.wrap(null);
            }

            return cy.
                apiCreatePage(wikiId, `Page Depth ${currentDepth + 1} Child ${childIndex + 1} ${getRandomId()}`, defaultContent, parentId).
                then(({page: childPage}) => {
                    pages.push(childPage);
                    return createChildren(childPage.id, currentDepth + 1, 0).then(() => {
                        return createChildren(parentId, currentDepth, childIndex + 1);
                    });
                });
        };

        return createChildren(rootPage.id, 1, 0).then(() => {
            return cy.wrap({pages, rootPage});
        });
    });
}

Cypress.Commands.add('apiCreatePageHierarchy', apiCreatePageHierarchy);

/**
 * Save a page draft.
 * @param {string} wikiId - The wiki ID
 * @param {string} pageId - The page ID. Use valid 26-char ID for existing pages, or empty/'new' to create a new draft.
 * @param {string} content - Draft content (TipTap JSON string)
 * @param {string} title - Draft title (optional)
 * @returns {any} `out.draft` as page draft object
 *
 * @example
 *   // Update existing page draft
 *   cy.apiSavePageDraft(wikiId, existingPageId, '{"type":"doc","content":[]}', 'Draft Title').then(({draft}) => {
 *       // do something with draft
 *   });
 *
 *   // Create new page draft
 *   cy.apiSavePageDraft(wikiId, '', '{"type":"doc","content":[]}', 'New Draft').then(({draft}) => {
 *       // draft.page_id contains the server-generated ID
 *   });
 */
function apiSavePageDraft(
    wikiId: string,
    pageId: string,
    content: string,
    title = '',
): ChainableT<{draft: any}> {
    // Check if this is a valid 26-char Mattermost ID
    const isValidId = pageId.length === 26 && /^[a-z0-9]+$/i.test(pageId);

    if (isValidId) {
        // Update existing draft via PUT
        return cy.request({
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            url: `/api/v4/wikis/${wikiId}/drafts/${pageId}`,
            method: 'PUT',
            body: {
                content,
                title,
                props: null,
            },
        }).then((response) => {
            expect(response.status).to.equal(200);
            return cy.wrap({draft: response.body});
        });
    }

    // Create new draft via POST
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/wikis/${wikiId}/drafts`,
        method: 'POST',
        body: {
            title,
            page_parent_id: '',
        },
    }).then((response) => {
        expect(response.status).to.equal(201);
        const draft = response.body;

        // If content was provided, update the draft with content
        if (content && content !== '{"type":"doc","content":[]}') {
            return cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: `/api/v4/wikis/${wikiId}/drafts/${draft.page_id}`,
                method: 'PUT',
                body: {
                    content,
                    title,
                    props: null,
                },
            }).then((updateResponse) => {
                expect(updateResponse.status).to.equal(200);
                return cy.wrap({draft: updateResponse.body});
            });
        }

        return cy.wrap({draft});
    });
}

Cypress.Commands.add('apiSavePageDraft', apiSavePageDraft);

/**
 * Get all pages for a wiki with timing.
 * @param {string} wikiId - The wiki ID
 * @returns {any} `out.pages` as array of pages, `out.duration` as load time in ms
 *
 * @example
 *   cy.apiGetWikiPages(wikiId).then(({pages, duration}) => {
 *       expect(duration).to.be.lessThan(1000); // Assert load time < 1s
 *   });
 */
function apiGetWikiPages(wikiId: string): ChainableT<{pages: any[]; duration: number}> {
    const startTime = Date.now();
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/wikis/${wikiId}/pages`,
        method: 'GET',
    }).then((response) => {
        const duration = Date.now() - startTime;
        expect(response.status).to.equal(200);
        return cy.wrap({pages: response.body, duration});
    });
}

Cypress.Commands.add('apiGetWikiPages', apiGetWikiPages);

/**
 * Get a single page with timing.
 * @param {string} wikiId - The wiki ID
 * @param {string} pageId - The page ID
 * @returns {any} `out.page` as page object, `out.duration` as load time in ms
 *
 * @example
 *   cy.apiGetPage(wikiId, pageId).then(({page, duration}) => {
 *       expect(duration).to.be.lessThan(500); // Assert load time < 500ms
 *   });
 */
function apiGetPage(wikiId: string, pageId: string): ChainableT<{page: any; duration: number}> {
    const startTime = Date.now();
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/wikis/${wikiId}/pages/${pageId}`,
        method: 'GET',
    }).then((response) => {
        const duration = Date.now() - startTime;
        expect(response.status).to.equal(200);
        return cy.wrap({page: response.body, duration});
    });
}

Cypress.Commands.add('apiGetPage', apiGetPage);

/**
 * Delete a page.
 * @param {string} wikiId - The wiki ID
 * @param {string} pageId - The page ID
 * @returns {Cypress.Chainable} Response
 */
function apiDeletePage(wikiId: string, pageId: string): Cypress.Chainable {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/wikis/${wikiId}/pages/${pageId}`,
        method: 'DELETE',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
}

Cypress.Commands.add('apiDeletePage', apiDeletePage);


declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            apiCreateWiki(channelId: string, title: string, description?: string): ChainableT<{wiki: any}>;
            apiCreatePage(wikiId: string, title: string, content: string, pageParentId?: string): ChainableT<{page: any}>;
            apiCreatePageHierarchy(wikiId: string, depth?: number, childrenPerLevel?: number): ChainableT<{pages: any[]; rootPage: any}>;
            apiSavePageDraft(wikiId: string, pageId: string, content: string, title?: string): ChainableT<{draft: any}>;
            apiGetWikiPages(wikiId: string): ChainableT<{pages: any[]; duration: number}>;
            apiGetPage(wikiId: string, pageId: string): ChainableT<{page: any; duration: number}>;
            apiDeletePage(wikiId: string, pageId: string): Chainable;
        }
    }
}
