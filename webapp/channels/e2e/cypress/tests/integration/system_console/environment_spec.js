// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @not_cloud

import * as TIMEOUTS from '../../fixtures/timeouts';

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
        cy.findByTestId('ServiceSettings.WebserverModedropdown').should('have.value', 'gzip');

        // # Navigate to a channel
        cy.visit(townsquareLink);

        // # Open team menu and click "Team Settings"
        cy.uiOpenTeamMenu('Team Settings');

        // * Check that the 'Team Settings' modal was opened
        cy.get('#teamSettingsModal').should('exist').within(() => {
            // clicking on edit button
            cy.get('#team_iconEdit').should('be.visible').click();

            // verify the settings picture button is visible to click
            cy.findByTestId('inputSettingPictureButton').should('be.visible').click();

            // * Before uploading the picture the save button must be disabled
            cy.uiSaveButton().should('be.disabled');

            // # Upload a file on center view
            cy.findByTestId('uploadPicture').attachFile(mattermostIcon);

            // after uploading the picture the save button must be disabled
            cy.uiSave().wait(TIMEOUTS.HALF_SEC);

            // # Close the modal
            cy.get('#teamSettingsModalLabel').find('button').should('be.visible').click();
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
        cy.findByTestId('ServiceSettings.WebserverModedropdown').select('Uncompressed');

        // # Click Save button to save the settings
        cy.get('#saveSetting').click().wait(TIMEOUTS.ONE_SEC);

        // # Navigate to a channel
        cy.visit(townsquareLink);

        // # Open team menu and click "Team Settings"
        cy.uiOpenTeamMenu('Team Settings');

        // * Check that the 'Team Settings' modal was opened
        cy.get('#teamSettingsModal').should('exist').within(() => {
            // clicking on edit button
            cy.get('#team_iconEdit').should('be.visible').click();

            // verify the settings picture button is visible to click
            cy.findByTestId('inputSettingPictureButton').should('be.visible').click();

            // * Before uploading the picture the save button must be disabled
            cy.uiSaveButton().should('be.disabled');

            // # Upload a file on center view
            cy.findByTestId('uploadPicture').attachFile(mattermostIcon);

            // * After uploading the picture the save button must be disabled
            cy.uiSave().wait(TIMEOUTS.HALF_SEC);

            // # Close the modal
            cy.get('#teamSettingsModalLabel').find('button').should('be.visible').click();
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
        cy.findByTestId('ServiceSettings.WebserverModedropdown').select('Disabled');

        // # Click Save button to save the settings
        cy.get('#saveSetting').click().wait(TIMEOUTS.ONE_SEC);

        // # Navigate to a channel
        cy.visit(townsquareLink);

        // # Open team menu and click "Team Settings"
        cy.uiOpenTeamMenu('Team Settings');

        // * Check that the 'Team Settings' modal was opened
        cy.get('#teamSettingsModal').should('exist').within(() => {
            // clicking on edit button
            cy.get('#team_iconEdit').should('be.visible').click();

            // verify the settings picture button is visible to click
            cy.findByTestId('inputSettingPictureButton').should('be.visible').click();

            // * Before uploading the picture the save button must be disabled
            cy.uiSaveButton().should('be.disabled');

            // # Upload a file on center view
            cy.findByTestId('uploadPicture').attachFile(mattermostIcon);

            // * After uploading the picture the save button must be disabled
            cy.uiSave().wait(TIMEOUTS.HALF_SEC);

            // # Close the modal
            cy.get('#teamSettingsModalLabel').find('button').should('be.visible').click();
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
        cy.findByTestId('queryTimeoutinput').clear().type(queryTimeoutValue);
        cy.findByTestId('maxOpenConnsinput').clear().type(maxOpenConnsValue);

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
            cy.findByTestId('minimumHashtagLengthinput').clear().type(length);

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
        cy.findByTestId('FileSettings.DriverNamedropdown').select('Amazon S3');

        // Check that these fields are disabled
        cy.findByTestId('FileSettings.Directoryinput').should('be.disabled');

        // Check that these fields are not disabled
        cy.findByTestId('FileSettings.MaxFileSizenumber').should('not.be.disabled');
        cy.findByTestId('FileSettings.AmazonS3Bucketinput').should('not.be.disabled');
        cy.findByTestId('FileSettings.AmazonS3PathPrefixinput').should('not.be.disabled');
        cy.findByTestId('FileSettings.AmazonS3Regioninput').should('not.be.disabled');
        cy.findByTestId('FileSettings.AmazonS3AccessKeyIdinput').should('not.be.disabled');

        const amazonS3BucketName = 'test';
        const amazonS3PathPrefix = 'test';
        cy.findByTestId('FileSettings.MaxFileSizenumber').clear().type(52428800);
        cy.findByTestId('FileSettings.AmazonS3Bucketinput').clear().type(amazonS3BucketName);
        cy.findByTestId('FileSettings.AmazonS3PathPrefixinput').clear().type(amazonS3PathPrefix);

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
        cy.findByTestId('FileSettings.DriverNamedropdown').select('Amazon S3');

        const amazonS3PathPrefix = 'test';
        cy.findByTestId('FileSettings.AmazonS3Bucketinput').clear();
        cy.findByTestId('FileSettings.AmazonS3PathPrefixinput').scrollIntoView().clear().type(amazonS3PathPrefix);

        // # Click Save button to save the settings
        cy.get('#saveSetting').click().wait(TIMEOUTS.ONE_SEC);

        cy.get('#TestS3Connection').scrollIntoView().should('be.visible').within(() => {
            cy.findByText('Test Connection').should('be.visible').click().wait(TIMEOUTS.ONE_SEC);
            waitForAlert('Connection unsuccessful: S3 Bucket is required');
        });

        const amazonS3BucketName = '12';
        cy.findByTestId('FileSettings.AmazonS3Bucketinput').clear().type(amazonS3BucketName);

        // # Click Save button to save the settings
        cy.get('#saveSetting').click().wait(TIMEOUTS.ONE_SEC);

        cy.get('#TestS3Connection').scrollIntoView().should('be.visible').within(() => {
            cy.findByText('Test Connection').should('be.visible').click().wait(TIMEOUTS.ONE_SEC);
            waitForAlert('Connection unsuccessful: Unable to connect to S3. Verify your Amazon S3 connection authorization parameters and authentication settings.');
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

    function waitForAlert(message) {
        cy.waitUntil(() => cy.get('.alert').scrollIntoView().should('be.visible').then((alert) => {
            return alert[0].innerText === message;
        }));
    }
});
