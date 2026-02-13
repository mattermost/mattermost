// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @metrics @wiki @performance

describe('Wiki > Page Hierarchy Load Performance', () => {
    let testChannel;
    let testWiki;
    let hierarchyPages = [];

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
            cy.apiCreateWiki(testChannel.id, 'Hierarchy Test Wiki', 'Testing hierarchy load performance').then(({wiki}) => {
                testWiki = wiki;
            });
        });
    });

    after(() => {
        // Cleanup: Delete all hierarchy pages
        hierarchyPages.forEach((page) => {
            cy.apiDeletePage(testWiki.id, page.id);
        });
    });

    it('MM-T5010 - Small hierarchy (depth=2, width=3) should load within acceptable time', () => {
        // # Create a small hierarchy: 2 levels deep, 3 children per level
        cy.apiCreatePageHierarchy(testWiki.id, 2, 3).then(({pages, rootPage}) => {
            hierarchyPages = pages;

            // * Verify hierarchy was created
            expect(pages.length, 'Should create correct number of pages').to.equal(1 + 3); // root + 3 children
            expect(rootPage).to.exist;

            // # Load all wiki pages (simulates loading left navigation tree)
            cy.apiGetWikiPages(testWiki.id).then(({pages: loadedPages, duration}) => {
                // * Verify all pages were loaded
                expect(loadedPages.length).to.be.at.least(pages.length);

                // * Assert hierarchy load time is acceptable
                expect(duration, 'Small hierarchy load should be under 800ms').to.be.lessThan(800);

                cy.log(`Small hierarchy load time: ${duration}ms`);
                cy.log(`Pages loaded: ${loadedPages.length}`);
            });
        });
    });

    it('MM-T5011 - Medium hierarchy (depth=3, width=3) should load within acceptable time', () => {
        // # Cleanup previous hierarchy
        hierarchyPages.forEach((page) => {
            cy.apiDeletePage(testWiki.id, page.id);
        });
        hierarchyPages = [];

        // # Create a medium hierarchy: 3 levels deep, 3 children per level
        cy.apiCreatePageHierarchy(testWiki.id, 3, 3).then(({pages, rootPage}) => {
            hierarchyPages = pages;

            // * Verify hierarchy was created
            // 1 root + 3 children + 9 grandchildren = 13 pages
            expect(pages.length, 'Should create correct number of pages').to.equal(1 + 3 + 9);
            expect(rootPage).to.exist;

            // # Load all wiki pages
            cy.apiGetWikiPages(testWiki.id).then(({pages: loadedPages, duration}) => {
                // * Verify all pages were loaded
                expect(loadedPages.length).to.be.at.least(pages.length);

                // * Assert hierarchy load time is acceptable
                expect(duration, 'Medium hierarchy load should be under 1500ms').to.be.lessThan(1500);

                cy.log(`Medium hierarchy load time: ${duration}ms`);
                cy.log(`Pages loaded: ${loadedPages.length}`);
            });
        });
    });

    it('MM-T5012 - Hierarchy load metrics should be recorded in Prometheus', () => {
        // # Load wiki pages to generate hierarchy metrics
        cy.apiGetWikiPages(testWiki.id);

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

                // * Verify hierarchy load metrics exist
                expect(metricsText, 'Should contain hierarchy load metric').to.include('mattermost_wiki_hierarchy_load_seconds');

                // * Verify hierarchy depth metric exists
                expect(metricsText, 'Should contain hierarchy depth metric').to.include('mattermost_wiki_hierarchy_depth');

                cy.log('Wiki hierarchy metrics are being recorded successfully');
            });
        });
    });

    it('MM-T5013 - Deep hierarchy (depth=4, width=2) should load within acceptable time', () => {
        // # Cleanup previous hierarchy
        hierarchyPages.forEach((page) => {
            cy.apiDeletePage(testWiki.id, page.id);
        });
        hierarchyPages = [];

        // # Create a deep hierarchy: 4 levels deep, 2 children per level
        cy.apiCreatePageHierarchy(testWiki.id, 4, 2).then(({pages, rootPage}) => {
            hierarchyPages = pages;

            // * Verify hierarchy was created
            // 1 root + 2 children + 4 grandchildren + 8 great-grandchildren = 15 pages
            expect(pages.length, 'Should create correct number of pages').to.equal(1 + 2 + 4 + 8);
            expect(rootPage).to.exist;

            // # Load all wiki pages
            cy.apiGetWikiPages(testWiki.id).then(({pages: loadedPages, duration}) => {
                // * Verify all pages were loaded
                expect(loadedPages.length).to.be.at.least(pages.length);

                // * Assert hierarchy load time is acceptable (deeper hierarchy may take longer)
                expect(duration, 'Deep hierarchy load should be under 2000ms').to.be.lessThan(2000);

                cy.log(`Deep hierarchy load time: ${duration}ms`);
                cy.log(`Pages loaded: ${loadedPages.length}`);
                cy.log(`Hierarchy depth: 4`);
            });
        });
    });

    it('MM-T5014 - Repeated hierarchy loads should have consistent performance', () => {
        const loadTimes = [];

        // # Load hierarchy multiple times
        for (let i = 0; i < 5; i++) {
            cy.apiGetWikiPages(testWiki.id).then(({duration}) => {
                loadTimes.push(duration);
            });
        }

        // # After all loads complete, analyze performance
        cy.wrap(null).then(() => {
            // * Calculate performance statistics
            const avgLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
            const maxLoadTime = Math.max(...loadTimes);
            const minLoadTime = Math.min(...loadTimes);
            const variance = loadTimes.reduce((sum, time) => sum + Math.pow(time - avgLoadTime, 2), 0) / loadTimes.length;
            const stdDev = Math.sqrt(variance);

            cy.log(`Average load time: ${avgLoadTime.toFixed(2)}ms`);
            cy.log(`Min load time: ${minLoadTime}ms`);
            cy.log(`Max load time: ${maxLoadTime}ms`);
            cy.log(`Standard deviation: ${stdDev.toFixed(2)}ms`);

            // * Assert average load time is acceptable
            expect(avgLoadTime, 'Average hierarchy load should be under 1500ms').to.be.lessThan(1500);

            // * Assert performance is consistent (low variance)
            expect(stdDev, 'Load time variance should be low (consistent performance)').to.be.lessThan(500);

            // * Assert no extreme outliers
            expect(maxLoadTime, 'Max load time should not be excessive').to.be.lessThan(3000);
        });
    });

    it('MM-T5015 - Empty wiki hierarchy should load very quickly', () => {
        // # Create a new empty wiki
        cy.apiCreateWiki(testChannel.id, 'Empty Wiki', 'For testing empty hierarchy load').then(({wiki}) => {
            // # Load pages from empty wiki
            cy.apiGetWikiPages(wiki.id).then(({pages, duration}) => {
                // * Verify no pages exist
                expect(pages.length, 'Empty wiki should have no pages').to.equal(0);

                // * Assert empty hierarchy loads very quickly
                expect(duration, 'Empty hierarchy should load in under 200ms').to.be.lessThan(200);

                cy.log(`Empty hierarchy load time: ${duration}ms`);
            });
        });
    });
});
