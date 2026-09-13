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
// Custom command should follow naming convention of having `ui` prefix, e.g. `uiOpenFilePreviewModal`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Get file thumbnail from a post
         *
         * @param {string} filename
         *
         * @example
         *   cy.uiGetFileThumbnail('image.png');
         */
        uiGetFileThumbnail(filename: string): Chainable;

        /**
         * Get file upload preview located below post textbox
         *
         * @example
         *   cy.uiGetFileUploadPreview();
         */
        uiGetFileUploadPreview(): Chainable;

        /**
         * Wait for file upload preview located below post textbox
         *
         * @example
         *   cy.uiGetFileUploadPreview();
         */
        uiGetFileUploadPreview(): Chainable;

        /**
         * Get file preview modal
         *
         * @param {bool} option.exist - Set to false to not verify if the element exists. Otherwise, true (default) to check existence.
         *
         * @example
         *   cy.uiGetFilePreviewModal();
         */
        uiGetFilePreviewModal(option: Record<string, boolean>): Chainable;

        /**
         * Get Public Link
         *
         * @param {bool} option.exist - Set to false to not verify if the element exists. Otherwise, true (default) to check existence.
         *
         * @example
         *   cy.uiGetPublicLink();
         */
        uiGetPublicLink(option: Record<string, boolean>): Chainable;

        /**
         * Open file preview modal
         *
         * @param {string} filename
         *
         * @example
         *   cy.uiOpenFilePreviewModal('image.png');
         */
        uiOpenFilePreviewModal(filename: string): Chainable;

        /**
         * Close file preview modal
         *
         * @example
         *   cy.uiCloseFilePreviewModal();
         */
        uiCloseFilePreviewModal(): Chainable;

        /**
         * Get main content of file preview modal
         *
         * @example
         *   cy.uiGetContentFilePreviewModal();
         */
        uiGetContentFilePreviewModal(): Chainable;

        /**
         * Get download link button from file preview modal
         *
         * @example
         *   cy.uiGetDownloadLinkFilePreviewModal();
         */
        uiGetDownloadLinkFilePreviewModal(): Chainable;

        /**
         * Get download button from file preview modal
         *
         * @example
         *   cy.uiGetDownloadFilePreviewModal();
         */
        uiGetDownloadFilePreviewModal(): Chainable;

        /**
         * Get arrow left button from file preview modal
         *
         * @example
         *   cy.uiGetArrowLeftFilePreviewModal();
         */
        uiGetArrowLeftFilePreviewModal(): Chainable;

        /**
         * Get arrow right button from file preview modal
         *
         * @example
         *   cy.uiGetArrowRightFilePreviewModal();
         */
        uiGetArrowRightFilePreviewModal(): Chainable;
    }
}
