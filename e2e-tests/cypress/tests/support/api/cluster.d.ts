// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="cypress" />

// ***************************************************************
// Each command should be properly documented using JSDoc.
// See https://jsdoc.app/index.html for reference.
// Basic requirements for documentation are the following:
// - Meaningful description
// - Specific link to https://api.mattermost.com
// - Each parameter with `@params`
// - Return value with `@returns`
// - Example usage with `@example`
// Custom command should follow naming convention of having `api` prefix, e.g. `apiLogin`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Get cluster status
         * See https://api.mattermost.com/#tag/cluster/operation/GetClusterStatus
         * @returns {ClusterInfo[]} out.clusterInfo: `ClusterInfo[]` object
         *
         * @example
         *   cy.apiGetClusterStatus();
         */
        apiGetClusterStatus(): Chainable<{clusterInfo: ClusterInfo[]}>;
    }
}
