// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

Cypress.Commands.add('uiGetFileThumbnail', (filename) => {
    // Gallery tiles preserve original filename casing on data-file-name,
    // while the legacy thumbnail aria-label is always lowercased
    // (see file_preview.tsx). Match each accordingly.
    const tileMatches = Cypress.$('[data-testid="media-gallery-tile"]').filter((_, el) => {
        return el.getAttribute('data-file-name')?.toLowerCase() === filename.toLowerCase();
    });
    if (tileMatches.length) {
        return cy.wrap(tileMatches);
    }
    return cy.findByLabelText(`file thumbnail ${filename.toLowerCase()}`);
});

Cypress.Commands.add('uiGetFileUploadPreview', () => {
    return cy.get('.file-preview__container');
});

Cypress.Commands.add('uiWaitForFileUploadPreview', () => {
    cy.waitUntil(() => cy.uiGetFileUploadPreview().then((el) => {
        return el.find('.post-image__thumbnail').length > 0;
    }));
});

Cypress.Commands.add('uiGetFilePreviewModal', (options = {exist: true}) => {
    if (options.exist) {
        return cy.get('.file-preview-modal').should('be.visible');
    }

    return cy.get('.file-preview-modal').should('not.exist');
});

Cypress.Commands.add('uiGetPublicLink', (options = {exist: true}) => {
    if (options.exist) {
        return cy.get('.file-preview-modal [aria-label="Get a public link"]').should('be.visible');
    }
    return cy.get('.file-preview-modal [aria-label="Get a public link"]').should('not.exist');
});

Cypress.Commands.add('uiGetHeaderFilePreviewModal', () => {
    return cy.uiGetFilePreviewModal().find('.file-preview-modal-header').should('be.visible');
});

Cypress.Commands.add('uiOpenFilePreviewModal', (filename) => {
    if (filename) {
        cy.uiGetFileThumbnail(filename).click();
        return;
    }
    if (Cypress.$('[data-testid="media-gallery-tile"]').length) {
        cy.get('[data-testid="media-gallery-tile"]').first().click();
    } else {
        cy.findByTestId('fileAttachmentList').children().first().click();
    }
});

Cypress.Commands.add('uiCloseFilePreviewModal', () => {
    return cy.uiGetFilePreviewModal().findByRole('button', {name: 'Close'}).click();
});

Cypress.Commands.add('uiGetContentFilePreviewModal', () => {
    return cy.uiGetFilePreviewModal().find('.file-preview-modal__content');
});

Cypress.Commands.add('uiGetDownloadLinkFilePreviewModal', () => {
    return cy.uiGetFilePreviewModal().find('[aria-label="Get a public link"], [aria-label="Public link copied"]');
});

Cypress.Commands.add('uiGetDownloadFilePreviewModal', () => {
    return cy.uiGetFilePreviewModal().find('.file-preview-modal-main-actions__download');
});

Cypress.Commands.add('uiGetArrowLeftFilePreviewModal', () => {
    return cy.uiGetFilePreviewModal().find('.file_preview_modal_main_nav__prev');
});

Cypress.Commands.add('uiGetArrowRightFilePreviewModal', () => {
    return cy.uiGetFilePreviewModal().find('.file_preview_modal_main_nav__next');
});
