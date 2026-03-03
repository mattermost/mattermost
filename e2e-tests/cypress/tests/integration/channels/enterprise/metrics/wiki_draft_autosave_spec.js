// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @metrics @wiki @performance

describe('Wiki > Page Draft Autosave Performance', () => {
    let testChannel;
    let testWiki;
    let testPage;

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
            cy.apiCreateWiki(testChannel.id, 'Draft Test Wiki', 'Testing draft autosave performance').then(({wiki}) => {
                testWiki = wiki;

                // # Create a test page
                cy.apiCreatePage(
                    testWiki.id,
                    'Test Page for Drafts',
                    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Initial content"}]}]}',
                ).then(({page}) => {
                    testPage = page;
                });
            });
        });
    });

    after(() => {
        // Cleanup: Delete test page
        if (testPage) {
            cy.apiDeletePage(testWiki.id, testPage.id);
        }
    });

    it('MM-T5020 - Single draft save should complete within acceptable time', () => {
        const startTime = Date.now();

        // # Save a draft for the test page
        cy.apiSavePageDraft(
            testWiki.id,
            testPage.id,
            '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content update"}]}]}',
            'Draft Title',
        ).then(({draft}) => {
            const duration = Date.now() - startTime;

            // * Verify draft was saved
            expect(draft).to.exist;
            expect(draft.wiki_id).to.equal(testWiki.id);

            // * Assert draft save completed quickly
            expect(duration, 'Draft save should complete in under 500ms').to.be.lessThan(500);

            cy.log(`Draft save time: ${duration}ms`);
        });
    });

    it('MM-T5021 - Multiple rapid draft saves should maintain performance', () => {
        const saveTimes = [];
        const draftContent = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated draft content ';

        // # Simulate rapid autosave (5 saves in succession)
        for (let i = 0; i < 5; i++) {
            const startTime = Date.now();
            cy.apiSavePageDraft(
                testWiki.id,
                testPage.id,
                `${draftContent}${i}"}]}]}`,
                `Draft Title ${i}`,
            ).then(() => {
                const duration = Date.now() - startTime;
                saveTimes.push(duration);
            });
        }

        // # After all saves complete, analyze performance
        cy.wrap(null).then(() => {
            // * Calculate average save time
            const avgSaveTime = saveTimes.reduce((a, b) => a + b, 0) / saveTimes.length;
            const maxSaveTime = Math.max(...saveTimes);

            cy.log(`Average draft save time: ${avgSaveTime.toFixed(2)}ms`);
            cy.log(`Max draft save time: ${maxSaveTime}ms`);
            cy.log(`Save times: ${saveTimes.join(', ')}ms`);

            // * Assert average save time is acceptable
            expect(avgSaveTime, 'Average draft save should be under 400ms').to.be.lessThan(400);

            // * Assert no single save is excessively slow
            expect(maxSaveTime, 'Max draft save should be under 800ms').to.be.lessThan(800);
        });
    });

    it('MM-T5022 - Draft save for new page should complete within acceptable time', () => {
        const startTime = Date.now();

        // # Save a draft for a new page (not yet created)
        // Use empty string to indicate new draft - server will generate page ID
        cy.apiSavePageDraft(
            testWiki.id,
            '',
            '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"New page draft content"}]}]}',
            'New Page Draft Title',
        ).then(({draft}) => {
            const duration = Date.now() - startTime;

            // * Verify draft was saved
            expect(draft).to.exist;
            expect(draft.wiki_id).to.equal(testWiki.id);

            // * Assert new page draft save completed quickly
            expect(duration, 'New page draft save should complete in under 500ms').to.be.lessThan(500);

            cy.log(`New page draft save time: ${duration}ms`);
        });
    });

    it('MM-T5023 - Large draft content should save within acceptable time', () => {
        // # Generate large content (simulate ~10KB draft)
        const largeText = 'Lorem ipsum dolor sit amet. '.repeat(400); // ~10KB
        const largeContent = `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"${largeText}"}]}]}`;

        const startTime = Date.now();

        // # Save large draft
        cy.apiSavePageDraft(
            testWiki.id,
            testPage.id,
            largeContent,
            'Large Draft Title',
        ).then(({draft}) => {
            const duration = Date.now() - startTime;

            // * Verify draft was saved
            expect(draft).to.exist;

            // * Assert large draft save completed in acceptable time
            expect(duration, 'Large draft (~10KB) save should complete in under 1000ms').to.be.lessThan(1000);

            cy.log(`Large draft save time: ${duration}ms`);
            cy.log(`Draft size: ~${(largeContent.length / 1024).toFixed(2)}KB`);
        });
    });

    it('MM-T5024 - Draft save metrics should be recorded in Prometheus', () => {
        // # Save a draft to generate metrics
        cy.apiSavePageDraft(
            testWiki.id,
            testPage.id,
            '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Metric test draft"}]}]}',
            'Metric Test',
        );

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

                // * Verify draft save metrics exist
                expect(metricsText, 'Should contain draft save total metric').to.include('mattermost_wiki_draft_saves_total');
                expect(metricsText, 'Should track success results').to.include('result="success"');

                cy.log('Wiki draft save metrics are being recorded successfully');
            });
        });
    });

    it('MM-T5025 - Concurrent draft saves should handle gracefully', () => {
        const saveTimes = [];

        // # Simulate concurrent saves to the same page (realistic autosave scenario)
        [0, 1, 2].forEach((index) => {
            const startTime = Date.now();
            cy.apiSavePageDraft(
                testWiki.id,
                testPage.id,
                `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Concurrent draft ${index}"}]}]}`,
                `Concurrent Draft ${index}`,
            ).then(() => {
                const duration = Date.now() - startTime;
                saveTimes.push(duration);
            });
        });

        // # After all saves complete, verify performance
        cy.wrap(null).then(() => {
            // * Verify all saves completed
            expect(saveTimes.length, 'All concurrent saves should complete').to.equal(3);

            // * Calculate max save time
            const maxSaveTime = Math.max(...saveTimes);

            cy.log(`Concurrent save times: ${saveTimes.join(', ')}ms`);
            cy.log(`Max concurrent save time: ${maxSaveTime}ms`);

            // * Assert concurrent saves don't cause excessive delays
            expect(maxSaveTime, 'Concurrent saves should complete in under 1000ms').to.be.lessThan(1000);
        });
    });

    it('MM-T5026 - Draft autosave burst (10 saves) should maintain reasonable performance', () => {
        const saveTimes = [];

        // # Simulate autosave burst (e.g., user typing continuously for 10 intervals)
        for (let i = 0; i < 10; i++) {
            const startTime = Date.now();
            cy.apiSavePageDraft(
                testWiki.id,
                testPage.id,
                `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Burst draft update ${i}"}]}]}`,
                'Burst Draft',
            ).then(() => {
                const duration = Date.now() - startTime;
                saveTimes.push(duration);
            });
        }

        // # After burst completes, analyze performance
        cy.wrap(null).then(() => {
            // * Calculate performance statistics
            const avgSaveTime = saveTimes.reduce((a, b) => a + b, 0) / saveTimes.length;
            const maxSaveTime = Math.max(...saveTimes);
            const minSaveTime = Math.min(...saveTimes);

            cy.log(`Burst average save time: ${avgSaveTime.toFixed(2)}ms`);
            cy.log(`Burst min save time: ${minSaveTime}ms`);
            cy.log(`Burst max save time: ${maxSaveTime}ms`);

            // * Assert burst performance is acceptable
            expect(avgSaveTime, 'Burst average save time should be under 500ms').to.be.lessThan(500);

            // * Assert no extreme degradation during burst
            expect(maxSaveTime, 'Burst max save time should be under 1500ms').to.be.lessThan(1500);

            // * Verify burst doesn't cause increasing delays (detect performance degradation)
            const firstHalfAvg = saveTimes.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
            const secondHalfAvg = saveTimes.slice(5, 10).reduce((a, b) => a + b, 0) / 5;
            const degradationRatio = secondHalfAvg / firstHalfAvg;

            cy.log(`First half average: ${firstHalfAvg.toFixed(2)}ms`);
            cy.log(`Second half average: ${secondHalfAvg.toFixed(2)}ms`);
            cy.log(`Degradation ratio: ${degradationRatio.toFixed(2)}x`);

            // * Assert performance doesn't degrade significantly during burst
            // Note: 3x threshold accounts for expected database row-level locking overhead
            // when rapidly updating the same rows (MVCC tuple versioning, lock wait queuing)
            expect(degradationRatio, 'Performance should not degrade significantly (< 3x slower)').to.be.lessThan(3);
        });
    });
});
