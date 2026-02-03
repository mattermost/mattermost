// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @metrics @wiki @performance

describe('Wiki > Page Load Performance', () => {
    let testChannel;
    let testWiki;
    const testPages = [];

    before(() => {
        cy.apiRequireLicense();

        // # Enable metrics
        cy.apiUpdateConfig({
            MetricsSettings: {
                Enable: true,
            },
        });

        // # Create test team and channel
        cy.apiInitSetup().then(({channel}) => {
            testChannel = channel;

            // # Grant wiki (channel properties) and page permissions
            // Wiki operations now use manage_*_channel_properties permissions
            cy.apiGetRolesByNames(['channel_user']).then(({roles}) => {
                const role = roles[0];
                const permissions = [
                    ...role.permissions,
                    'manage_public_channel_properties',
                    'manage_private_channel_properties',
                    'create_page',
                ];
                cy.apiPatchRole(role.id, {permissions});
            });

            // # Create wiki
            cy.apiCreateWiki(testChannel.id, 'Performance Test Wiki', 'Testing page load performance').then(({wiki}) => {
                testWiki = wiki;

                // # Create multiple pages for testing using recursive approach
                const createPages = (index) => {
                    if (index >= 10) {
                        return;
                    }
                    cy.apiCreatePage(
                        testWiki.id,
                        `Test Page ${index + 1}`,
                        `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Content for page ${index + 1}"}]}]}`,
                    ).then(({page}) => {
                        testPages.push(page);
                        createPages(index + 1);
                    });
                };
                createPages(0);
            });
        });
    });

    after(() => {
        // Cleanup: Delete test pages
        testPages.forEach((page) => {
            cy.apiDeletePage(testWiki.id, page.id);
        });
    });

    it('MM-T5001 - Single page load should complete within acceptable time', () => {
        // # Get a single page and measure load time
        cy.apiGetPage(testWiki.id, testPages[0].id).then(({page, duration}) => {
            // * Verify page was loaded successfully
            expect(page).to.exist;
            expect(page.id).to.equal(testPages[0].id);

            // * Assert page load time is under 500ms
            expect(duration, 'Page load duration should be under 500ms').to.be.lessThan(500);

            cy.log(`Page load time: ${duration}ms`);
        });
    });

    it('MM-T5002 - Multiple page loads should maintain consistent performance', () => {
        const loadTimes = [];

        // # Load each page and collect timing data
        testPages.slice(0, 5).forEach((page) => {
            cy.apiGetPage(testWiki.id, page.id).then(({duration}) => {
                loadTimes.push(duration);
            });
        });

        // # After all loads complete, analyze performance
        cy.wrap(null).then(() => {
            // * Calculate average load time
            const avgLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
            const maxLoadTime = Math.max(...loadTimes);

            cy.log(`Average load time: ${avgLoadTime.toFixed(2)}ms`);
            cy.log(`Max load time: ${maxLoadTime}ms`);

            // * Assert average load time is acceptable
            expect(avgLoadTime, 'Average load time should be under 400ms').to.be.lessThan(400);

            // * Assert no single load is excessively slow
            expect(maxLoadTime, 'Max load time should be under 800ms').to.be.lessThan(800);
        });
    });

    it('MM-T5003 - Page load metrics should be recorded in Prometheus', () => {
        // # Load a page to generate metrics
        cy.apiGetPage(testWiki.id, testPages[0].id);

        // # Wait briefly for metrics to be recorded
        cy.wait(1000);

        // # Fetch Prometheus metrics
        cy.apiGetConfig().then(({config}) => {
            const baseURL = new URL(Cypress.config('baseUrl'));
            baseURL.port = config.MetricsSettings.ListenAddress.replace(/^.*:/, '');
            baseURL.pathname = '/metrics';

            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: baseURL.toString(),
                method: 'GET',
                failOnStatusCode: false,
            }).then((response) => {
                expect(response.status).to.equal(200);

                const metricsText = response.body;

                // * Verify wiki page operation metrics exist
                expect(metricsText, 'Should contain wiki page operation metric').to.include('mattermost_wiki_page_operation_duration_seconds');
                expect(metricsText, 'Should contain view operation').to.include('operation="view"');

                cy.log('Wiki page load metrics are being recorded successfully');
            });
        });
    });

    it('MM-T5004 - Page create operation should complete within acceptable time', () => {
        const startTime = Date.now();

        // # Create a new page
        cy.apiCreatePage(
            testWiki.id,
            'Performance Test Page',
            '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test content for performance"}]}]}',
        ).then(({page}) => {
            const duration = Date.now() - startTime;

            // * Verify page was created
            expect(page).to.exist;
            expect(page.id).to.not.be.empty;

            // Store for cleanup
            testPages.push(page);

            // * Assert create operation completed quickly
            expect(duration, 'Page create duration should be under 1000ms').to.be.lessThan(1000);

            cy.log(`Page create time: ${duration}ms`);
        });
    });

    it('MM-T5005 - Page update via draft publish should complete within acceptable time', () => {
        const testPage = testPages[0];
        const startTime = Date.now();

        // # Update a page by saving and publishing a draft
        const updatedContent = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated content via draft"}]}]}';

        cy.apiSavePageDraft(
            testWiki.id,
            testPage.id,
            updatedContent,
            'Updated Title',
        ).then(() => {
            // # Fetch fresh page state to get current update_at timestamp
            cy.apiGetPage(testWiki.id, testPage.id).then(({page}) => {
                // # Publish the draft to update the page
                cy.request({
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                    url: `/api/v4/wikis/${testWiki.id}/drafts/${testPage.id}/publish`,
                    method: 'POST',
                    body: {
                        title: 'Updated Title',
                        content: updatedContent,
                        search_text: '',
                        page_status: 'published',
                        base_update_at: page.update_at,
                        force: false,
                    },
                }).then((response) => {
                    const duration = Date.now() - startTime;

                    // * Verify page was updated (accepts both 200 and 201)
                    expect(response.status).to.be.oneOf([200, 201]);
                    expect(response.body).to.exist;

                    // * Assert update operation completed quickly
                    expect(duration, 'Page update duration should be under 1500ms').to.be.lessThan(1500);

                    cy.log(`Page update time: ${duration}ms`);
                });
            });
        });
    });

    it('MM-T5006 - Page delete operation should complete within acceptable time', () => {
        // # Create a page specifically for deletion
        cy.apiCreatePage(
            testWiki.id,
            'Page to Delete',
            '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Will be deleted"}]}]}',
        ).then(({page}) => {
            const startTime = Date.now();

            // # Delete the page
            cy.apiDeletePage(testWiki.id, page.id).then(() => {
                const duration = Date.now() - startTime;

                // * Assert delete operation completed quickly
                expect(duration, 'Page delete duration should be under 500ms').to.be.lessThan(500);

                cy.log(`Page delete time: ${duration}ms`);
            });
        });
    });
});
