// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="cypress" />

// ***************************************************************
// Each command should be properly documented using JSDoc.
// See https://jsdoc.app/index.html for reference.
// Basic requirements for documentation are the following:
// - Meaningful description
// - Each parameter with `@params`
// - Return value with `@returns`
// - Example usage with `@example`
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Go to Data Retention page
         */
        uiGoToDataRetentionPage(): Chainable;

        /**
         * Click create policy button
         */
        uiClickCreatePolicy(): Chainable;

        /**
         * Fill out custom policy form fields
         * @param {string} name - policy name
         * @param {string} durationDropdown - duration dropdown value (days, years, forever)
         * @param {string?} durationText - duration text
         */
        uiFillOutCustomPolicyFields(name: string, durationDropdown: string, durationText?: string): Chainable;

        /**
         * Search and add teams to custom policy
         * @param {string[]} teamNames - array of team names
         */
        uiAddTeamsToCustomPolicy(teamNames: string[]): Chainable;

        /**
         * Search and add channels to custom policy
         * @param {string[]} channelNames - array of channel names
         */
        uiAddChannelsToCustomPolicy(channelNames: string[]): Chainable;

        /**
         * Add teams to a custom policy
         * @param {number} numberOfTeams - number of teams to add to the policy
         */
        uiAddRandomTeamToCustomPolicy(numberOfTeams?: number): Chainable;

        /**
         * Add channels to a custom policy
         * @param {number} numberOfTeams - number of teams to add to the policy
         */
        uiAddRandomChannelToCustomPolicy(numberOfChannels?: number): Chainable;

        /**
         * Verify custom policy UI information
         * @param {string} policyId - Custom Policy ID
         * @param {string} description - The name of the policy
         * @param {string} duration - How long messages last in the policy
         * @param {string} appliedTo - Teams and channels the policy apples to
         */
        uiVerifyCustomPolicyRow(policyId: string, description: string, duration: string, appliedTo: string): Chainable;

        /**
         * Click edit custom policy
         * @param {string} policyId - Custom Policy ID
         */
        uiClickEditCustomPolicyRow(policyId: string): Chainable;

        /**
         * Verify custom create policy response
         * @param body - Response body
         * @param {number} teamCount - Number of teams the policy applies to
         * @param {number} channelCount - Number of channels the policy applies to
         * @param {number} duration - How long messages last in the policy
         * @param {string} displayName - The name of the policy
         */
        uiVerifyPolicyResponse(body, teamCount: number, channelCount: number, duration: number, displayName: string): Chainable;
    }
}
