// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @not_cloud

import * as TIMEOUTS from '@/fixtures/timeouts';

describe('Environment', () => {
    let townsquareLink;
    let testTeam;

    const mattermostIcon = 'mattermost-icon_128x128.png';
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.apiInitSetup().then(({team}) => {
            testTeam = team;
            townsquareLink = `/${team.name}/channels/town-square`;
        });
    });

    it('MM-T959 - Web server mode - Webserver gzip', () => {
        cy.visit('/admin_console/environment/web_server');

        // # Click dropdown to open selection
        cy.get('[data-testid="admin.setting:ServiceSettings.WebserverMode--group"] [data-testid="admin.setting.choice--combobox"]').should('have.value', 'gzip');

        // # Navigate to a channel
        cy.visit(townsquareLink);

        // # Open team menu and click "Team Settings"
        cy.uiOpenTeamMenu('Team settings');

        // * Check that the 'Team Settings' modal was opened
        cy.get('#teamSettingsModal').should('exist').within(() => {
            // # Verify upload icon button is visible
            cy.get('i[title="Edit Icon"]').should('be.visible');

            // # Upload a file on center view
            cy.findByTestId('team_settings_modal.info.picture.upload').attachFile(mattermostIcon);

            // after uploading the picture the save button must be disabled
            cy.uiSave().wait(TIMEOUTS.HALF_SEC);

            // # Close the modal
            cy.get('button[aria-label="Close"]').should('be.visible').click();
        });

        // Validate that the image is being displayed
        cy.get(`#${testTeam.name}TeamButton`).scrollIntoView().within(() => {
            cy.findByTestId('teamIconImage').then((imageDiv) => {
                const url = imageDiv.css('background-image').split('"')[1];

                // # Verify that the response to fetch image is successful and not emmpty
                cy.request({url, encoding: 'base64'}).then((response) => {
                    expect(response.status).to.equal(200);
                    expect(response.body).to.not.be.null;
                });
            });
        });
    });

    it('MM-T960 - Web server mode - Webserver Uncompressed', () => {
        cy.visit('/admin_console/environment/web_server');

        // # Click dropdown to open selection
        cy.get('[data-testid="admin.setting:ServiceSettings.WebserverMode--group"] [data-testid="admin.setting.choice--combobox"]').select('Uncompressed');

        // # Click Save button to save the settings
        cy.get('#saveSetting').click().wait(TIMEOUTS.ONE_SEC);

        // # Navigate to a channel
        cy.visit(townsquareLink);

        // # Open team menu and click "Team Settings"
        cy.uiOpenTeamMenu('Team settings');

        // * Check that the 'Team Settings' modal was opened
        cy.get('#teamSettingsModal').should('exist').within(() => {
            // # Verify upload icon button is visible
            cy.get('i[title="Edit Icon"]').should('be.visible');

            // # Upload a file on center view
            cy.findByTestId('team_settings_modal.info.picture.upload').attachFile(mattermostIcon);

            // * After uploading the picture the save button must be disabled
            cy.uiSave().wait(TIMEOUTS.HALF_SEC);

            // # Close the modal
            cy.get('button[aria-label="Close"]').should('be.visible').click();
        });

        // Validate that the image is being displayed
        cy.get(`#${testTeam.name}TeamButton`).scrollIntoView().within(() => {
            cy.findByTestId('teamIconImage').then((imageDiv) => {
                const url = imageDiv.css('background-image').split('"')[1];

                // # Verify that the response to fetch image is successful and not emmpty
                cy.request({url, encoding: 'base64'}).then((response) => {
                    expect(response.status).to.equal(200);
                    expect(response.body).to.not.be.null;
                });
            });
        });
    });

    it('MM-T961 - Web server mode - Webserver Disabled', () => {
        cy.visit('/admin_console/environment/web_server');

        // # Click dropdown to open selection
        cy.get('[data-testid="admin.setting:ServiceSettings.WebserverMode--group"] [data-testid="admin.setting.choice--combobox"]').select('Disabled');

        // # Click Save button to save the settings
        cy.get('#saveSetting').click().wait(TIMEOUTS.ONE_SEC);

        // # Navigate to a channel
        cy.visit(townsquareLink);

        // # Open team menu and click "Team Settings"
        cy.uiOpenTeamMenu('Team settings');

        // * Check that the 'Team Settings' modal was opened
        cy.get('#teamSettingsModal').should('exist').within(() => {
            // # Verify upload icon button is visible
            cy.get('i[title="Edit Icon"]').should('be.visible');

            // # Upload a file on center view
            cy.findByTestId('team_settings_modal.info.picture.upload').attachFile(mattermostIcon);

            // * After uploading the picture the save button must be disabled
            cy.uiSave().wait(TIMEOUTS.HALF_SEC);

            // # Close the modal
            cy.get('button[aria-label="Close"]').should('be.visible').click();
        });

        // Validate that the image is being displayed
        cy.get(`#${testTeam.name}TeamButton`).scrollIntoView().within(() => {
            cy.findByTestId('teamIconImage').then((imageDiv) => {
                const url = imageDiv.css('background-image').split('"')[1];

                // # Verify that the response to fetch image is successful not emmpty
                cy.request({url, encoding: 'base64'}).then((response) => {
                    expect(response.status).to.equal(200);
                    expect(response.body).to.not.be.null;
                });
            });
        });
    });

    it('MM-T991 - Database fields can be edited and saved', () => {
        cy.visit('/admin_console/environment/database');

        const queryTimeoutValue = 100;
        const maxOpenConnsValue = 1000;
        cy.get('[data-testid="admin.setting:queryTimeout--group"] [data-testid="admin.setting.value--textbox"]').clear().type(queryTimeoutValue);
        cy.get('[data-testid="admin.setting:maxOpenConns--group"] [data-testid="admin.setting.value--textbox"]').clear().type(maxOpenConnsValue);

        // # Click Save button to save the settings
        cy.get('#saveSetting').click().wait(TIMEOUTS.ONE_SEC);

        // Get config again
        cy.apiGetConfig().then(({config}) => {
            // * Verify the database setting values are saved
            expect(config.SqlSettings.QueryTimeout).to.eq(queryTimeoutValue);
            expect(config.SqlSettings.MaxOpenConns).to.eq(maxOpenConnsValue);
        });
    });

    it('MM-T993 - Minimum hashtag length at least 2', () => {
        const defaultHashtagLength = 3;
        const minimumHashtagLength = 2;

        function setAndVerifyHashtagLength(length) {
            cy.get('[data-testid="admin.setting:minimumHashtagLength--group"] [data-testid="admin.setting.value--textbox"]').clear().type(length);

            // # Click Save button to save the settings
            cy.get('#saveSetting').click({force: true}).wait(TIMEOUTS.ONE_SEC);

            // * Verify saved config value
            cy.apiGetConfig().then(({config}) => {
                const expectedLength = length < minimumHashtagLength ? defaultHashtagLength : length;
                expect(config.ServiceSettings.MinimumHashtagLength).to.eq(expectedLength);
            });
        }

        cy.visit('/admin_console/environment/database');

        setAndVerifyHashtagLength(4);
        setAndVerifyHashtagLength(1);
        setAndVerifyHashtagLength(2);
    });

    it('MM-T995 - Amazon S3 settings', () => {
        cy.visit('/admin_console/environment/file_storage');

        // # CLick dropdown to open selection
        cy.get('[data-testid="admin.setting:FileSettings.DriverName--group"] [data-testid="admin.setting.choice--combobox"]').select('Amazon S3');

        // Check that these fields are disabled
        cy.get('[data-testid="admin.setting:FileSettings.Directory--group"] [data-testid="admin.setting.value--textbox"]').should('be.disabled');

        // Check that these fields are not disabled
        cy.get('[data-testid="admin.setting:FileSettings.MaxFileSize--group"] [data-testid="admin.setting.number--spinbutton"]').should('not.be.disabled');
        cy.get('[data-testid="admin.setting:FileSettings.AmazonS3Bucket--group"] [data-testid="admin.setting.value--textbox"]').should('not.be.disabled');
        cy.get('[data-testid="admin.setting:FileSettings.AmazonS3PathPrefix--group"] [data-testid="admin.setting.value--textbox"]').should('not.be.disabled');
        cy.get('[data-testid="admin.setting:FileSettings.AmazonS3Region--group"] [data-testid="admin.setting.value--textbox"]').should('not.be.disabled');
        cy.get('[data-testid="admin.setting:FileSettings.AmazonS3AccessKeyId--group"] [data-testid="admin.setting.value--textbox"]').should('not.be.disabled');

        const amazonS3BucketName = 'test';
        const amazonS3PathPrefix = 'test';
        cy.get('[data-testid="admin.setting:FileSettings.MaxFileSize--group"] [data-testid="admin.setting.number--spinbutton"]').clear().type(52428800);
        cy.get('[data-testid="admin.setting:FileSettings.AmazonS3Bucket--group"] [data-testid="admin.setting.value--textbox"]').clear().type(amazonS3BucketName);
        cy.get('[data-testid="admin.setting:FileSettings.AmazonS3PathPrefix--group"] [data-testid="admin.setting.value--textbox"]').clear().type(amazonS3PathPrefix);

        // # Click Save button to save the settings
        cy.get('#saveSetting').click().wait(TIMEOUTS.ONE_SEC);

        // Get config again
        cy.apiGetConfig().then(({config}) => {
            // * Verify the database setting values are saved
            expect(config.FileSettings.AmazonS3Bucket).to.eq(amazonS3BucketName);
            expect(config.FileSettings.AmazonS3PathPrefix).to.eq(amazonS3PathPrefix);
        });
    });

    it('MM-T996 - Amazon S3 connection error messaging', () => {
        cy.visit('/admin_console/environment/file_storage');

        // # CLick dropdown to open selection
        cy.get('[data-testid="admin.setting:FileSettings.DriverName--group"] [data-testid="admin.setting.choice--combobox"]').select('Amazon S3');

        const amazonS3PathPrefix = 'test';
        cy.get('[data-testid="admin.setting:FileSettings.AmazonS3Bucket--group"] [data-testid="admin.setting.value--textbox"]').clear();
        cy.get('[data-testid="admin.setting:FileSettings.AmazonS3PathPrefix--group"] [data-testid="admin.setting.value--textbox"]').scrollIntoView().clear().type(amazonS3PathPrefix);

        // # Click Save button to save the settings
        cy.get('#saveSetting').click().wait(TIMEOUTS.ONE_SEC);

        cy.get('#TestFileStoreConnection').scrollIntoView().should('be.visible').within(() => {
            cy.findByText('Test Connection').should('be.visible').click().wait(TIMEOUTS.ONE_SEC);
            waitForAlert('Connection unsuccessful: S3 Bucket is required');
        });

        const amazonS3BucketName = '12';
        cy.get('[data-testid="admin.setting:FileSettings.AmazonS3Bucket--group"] [data-testid="admin.setting.value--textbox"]').clear().type(amazonS3BucketName);

        // # Click Save button to save the settings
        cy.get('#saveSetting').click().wait(TIMEOUTS.ONE_SEC);

        cy.get('#TestFileStoreConnection').scrollIntoView().should('be.visible').within(() => {
            cy.findByText('Test Connection').should('be.visible').click().wait(TIMEOUTS.ONE_SEC);
            waitForAlert('Connection unsuccessful: Unable to authenticate against the file storage backend. Verify your credentials and authentication settings.');
        });
    });

    it('MM-T963 - Configuration - Purge caches', () => {
        cy.visit('/admin_console/environment/web_server');

        // # Find the purge all caches button on the page and click it
        cy.get('#PurgeButton').scrollIntoView().should('be.visible').within(() => {
            cy.findByText('Purge All Caches').should('be.visible').click().wait(TIMEOUTS.ONE_SEC);
        });

        // # Reload the page
        cy.reload();

        // * Verify app continues to run successfully by querying for the header
        cy.get('.admin-console', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').within(() => {
            cy.get('.admin-console__header').should('be.visible').and('have.text', 'Web Server');
        });
    });

    describe('Web server mode - compression', () => {
        let originalWebserverMode;

        before(() => {
            cy.apiGetConfig().then(({config}) => {
                originalWebserverMode = config.ServiceSettings.WebserverMode;
            });
        });

        after(() => {
            cy.apiUpdateConfig({ServiceSettings: {WebserverMode: originalWebserverMode}});
        });

        it('can be set back to gzip and persists', () => {
            cy.visit('/admin_console/environment/web_server');

            cy.get('[data-testid="admin.setting:ServiceSettings.WebserverMode--group"] [data-testid="admin.setting.choice--combobox"]').select('gzip');
            cy.get('#saveSetting').click().wait(TIMEOUTS.ONE_SEC);

            cy.reload();
            cy.get('[data-testid="admin.setting:ServiceSettings.WebserverMode--group"] [data-testid="admin.setting.choice--combobox"]').should('have.value', 'gzip');

            cy.apiGetConfig().then(({config}) => {
                expect(config.ServiceSettings.WebserverMode).to.equal('gzip');
            });
        });
    });

    function waitForAlert(message) {
        cy.waitUntil(() => cy.get('.alert').scrollIntoView().should('be.visible').then((alert) => {
            return alert[0].innerText === message;
        }));
    }
});
