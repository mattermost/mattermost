// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

Cypress.Commands.add('uiGetFileThumbnail', (filename) => {
    return cy.findByLabelText(`file thumbnail ${filename.toLowerCase()}`);
});

Cypress.Commands.add('uiGetFileUploadPreview', () => {
    return cy.get('.file-preview__container');
});

Cypress.Commands.add('uiWaitForFileUploadPreview', () => {
    cy.waitUntil(() => cy.uiGetFileUploadPreview().then((el) => {
        return el.find('.post-image.normal').length > 0;
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
        return cy.get('.icon-link-variant').should('be.visible');
    }
    return cy.get('.icon-link-variant').should('not.exist');
});

Cypress.Commands.add('uiGetHeaderFilePreviewModal', () => {
    return cy.uiGetFilePreviewModal().find('.file-preview-modal-header').should('be.visible');
});

Cypress.Commands.add('uiOpenFilePreviewModal', (filename) => {
    if (filename) {
        cy.uiGetFileThumbnail(filename.toLowerCase()).click();
    } else {
        cy.findByTestId('fileAttachmentList').children().first().click();
    }
});

Cypress.Commands.add('uiCloseFilePreviewModal', () => {
    return cy.uiGetFilePreviewModal().find('.icon-close').click();
});

Cypress.Commands.add('uiGetContentFilePreviewModal', () => {
    return cy.uiGetFilePreviewModal().find('.file-preview-modal__content');
});

Cypress.Commands.add('uiGetDownloadLinkFilePreviewModal', () => {
    return cy.uiGetFilePreviewModal().find('.icon-link-variant').parent();
});

Cypress.Commands.add('uiGetDownloadFilePreviewModal', () => {
    return cy.uiGetFilePreviewModal().find('.icon-download-outline').parent();
});

Cypress.Commands.add('uiGetArrowLeftFilePreviewModal', () => {
    return cy.uiGetFilePreviewModal().find('.icon-chevron-left').parent();
});

Cypress.Commands.add('uiGetArrowRightFilePreviewModal', () => {
    return cy.uiGetFilePreviewModal().find('.icon-chevron-right').parent();
});
