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
         * Find file/s similar to "find" shell command
         * Extends find of shelljs, https://github.com/shelljs/shelljs#findpath--path-
         *
         * @param {string} path - file path
         * @param {RegExp} pattern - pattern to match with
         *
         * @example
         *    cy.shellFind('path', '/file.xml/').then((files) => {
         *        // do something with files
         *    });
         */
        shellFind(path: string, pattern: RegExp): Chainable;

        /**
         * Remove file/s similar to "rm" shell command
         * Extends rm of shelljs, https://github.com/shelljs/shelljs#rmoptions-file--file-
         *
         * @param {string} option - ex. -rf
         * @param {string} file - file/pattern to remove
         *
         * @example
         *    cy.shellRm('-rf', 'file.png');
         */
        shellRm(option: string, file: string): Chainable;

        /**
         * Unzip source file into a target folder
         *
         * @param {string} source - source file
         * @param {string} target - target folder
         *
         * @example
         *    cy.shellUnzip('source.zip', 'target-folder');
         */
        shellUnzip(source: string, target: string): Chainable;
    }
}
