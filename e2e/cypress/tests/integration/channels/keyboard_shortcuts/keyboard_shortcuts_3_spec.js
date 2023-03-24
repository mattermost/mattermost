// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @keyboard_shortcuts

import {isMac} from '../../../utils';

describe('Keyboard Shortcuts', () => {
    const count = 5;
    const teams = [];
    const channels = [];

    before(() => {
        cy.apiCreateCustomAdmin().then(({sysadmin}) => {
            cy.apiLogin(sysadmin);
            const prefix = 't0';
            cy.apiInitSetup({teamPrefix: {name: prefix, displayName: prefix}, channelPrefix: {name: prefix, displayName: prefix}}).then(({team, channel}) => {
                teams.push(team);
                channels.push(channel);

                cy.visit(`/${team.name}/channels/${channel.name}`);
                cy.postMessage('hello');

                for (let index = 1; index < count; index++) {
                    const otherPrefix = `t${index}`;

                    cy.apiCreateTeam(otherPrefix, otherPrefix).then(({team: otherTeam}) => {
                        teams.push(otherTeam);
                        cy.apiCreateChannel(otherTeam.id, otherPrefix, otherPrefix).then(({channel: otherChannel}) => {
                            channels.push(otherChannel);
                            cy.visit(`/${otherTeam.name}/channels/${otherChannel.name}`);
                            cy.postMessage('hello');
                        });
                    });
                }
            });
        });
    });

    it('MM-T1575 - Ability to Switch Teams', () => {
        for (let index = 0; index < count; index++) {
            // # Verify that we've switched to the correct team
            cy.uiGetLHSHeader().findByText(teams[count - index - 1].display_name);

            // # Verify that we've switched to the correct channel
            cy.get('#channelHeaderTitle').should('be.visible').should('contain', channels[count - index - 1].display_name);

            // # Press CTRL/CMD+SHIFT+UP
            if (isMac()) {
                cy.get('body').type('{cmd}{option}', {release: false}).type('{uparrow}').type('{cmd}{option}', {release: true});
            } else {
                cy.get('body').type('{ctrl}{shift}', {release: false}).type('{uparrow}').type('{ctrl}{shift}', {release: true});
            }
        }

        for (let index = 0; index < count; index++) {
            // # Press CTRL/CMD+SHIFT+DOWN
            if (isMac()) {
                cy.get('body').type('{cmd}{option}', {release: false}).type('{downarrow}').type('{cmd}{option}', {release: true});
            } else {
                cy.get('body').type('{ctrl}{shift}', {release: false}).type('{downarrow}').type('{ctrl}{shift}', {release: true});
            }

            // # Verify that we've switched to the correct team
            cy.uiGetLHSHeader().findByText(teams[index].display_name);

            // # Verify that we've switched to the correct channel
            cy.get('#channelHeaderTitle').should('be.visible').should('contain', channels[index].display_name);
        }

        for (let index = 1; index <= count; index++) {
            // # Press CTRL/CMD+SHIFT+index
            if (isMac()) {
                cy.get('body').type('{cmd}{option}', {release: false}).type(String(index)).type('{cmd}{option}', {release: true});
            } else {
                cy.get('body').type('{ctrl}{shift}', {release: false}).type(String(index)).type('{ctrl}{shift}', {release: true});
            }

            // # Verify that we've switched to the correct team
            cy.uiGetLHSHeader().findByText(teams[index - 1].display_name);

            // # Verify that we've switched to the correct channel
            cy.get('#channelHeaderTitle').should('be.visible').should('contain', channels[index - 1].display_name);
        }

        // # Verify keyboard shortcuts in Keyboard Shortcuts modal
        cy.uiOpenHelpMenu('Keyboard shortcuts');
        const name = isMac() ? /Keyboard Shortcuts ⌘ \// : /Keyboard Shortcuts Ctrl \//;
        cy.findByRole('dialog', {name}).within(() => {
            cy.findByText('Navigation').should('be.visible');
            cy.findByText('Previous team:').should('be.visible');
            cy.findAllByText('Next team:').should('be.visible');
            cy.findAllByText('Navigate to a specific team:').should('be.visible');
        });
    });
});
