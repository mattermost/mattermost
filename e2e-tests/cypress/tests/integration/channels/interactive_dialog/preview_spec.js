// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @not_cloud @interactive_dialog

/**
 * Note: This test requires webhook server running. Initiate `npm run start:webhook` to start.
 * Covers the "preview" element: /dialog/preview opens one dialog with a preview in each mode.
 */

const PDF_NAME = 'preview-demo.pdf';
const IMAGE_NAME = 'preview-demo.png';

let previewCommand;

// Opens the preview dialog and waits for its PDF previews to draw their first page.
function openPreviewDialog() {
    cy.postMessage(`/${previewCommand.trigger} `);
    cy.get('#appsModal').should('be.visible').within(() => {
        cy.get('#appsModalLabel').should('contain', 'Preview Demo');
    });
}

// Returns the form group (label, preview and help text) for a preview, by its label.
function previewGroup(label) {
    return cy.contains('#appsModal .form-group', label);
}

// An undrawn <canvas> keeps the HTML default size of 300x150; PDFPreview sets it to
// the page's size when it draws the page.
function isDrawn(canvas) {
    return !(canvas.width === 300 && canvas.height === 150);
}

describe('Interactive Dialog - Preview element', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.requireWebhookServer();

        cy.apiCreateTeam('test-team', 'Test Team').then(({team}) => {
            cy.visit(`/${team.name}`);

            cy.apiCreateCommand({
                auto_complete: false,
                description: 'Test for the dialog preview element',
                display_name: 'Preview Dialog Test',
                icon_url: '',
                method: 'P',
                team_id: team.id,
                trigger: 'preview_dialog',
                url: `${Cypress.expose().webhookBaseUrl}/dialog/preview`,
                username: '',
            }).then(({data}) => {
                previewCommand = data;
            });
        });
    });

    afterEach(() => {
        cy.reload();
    });

    it('renders a PDF as a scrollable viewer of every page, sized to its first page', () => {
        openPreviewDialog();

        previewGroup('Inline PDF').within(() => {
            // * The viewer is a labelled, keyboard-focusable button
            cy.findByRole('button', {name: `Open ${PDF_NAME}`}).as('viewer').
                should('have.attr', 'tabindex', '0').
                and('have.class', 'apps-form-preview__viewer');

            // * Every page has a canvas, and the first page has been drawn
            cy.get('@viewer').find('canvas').should('have.length', 6).first().
                should(($canvas) => expect(isDrawn($canvas[0]), 'first page drawn').to.be.true);

            // * The viewer is one page tall, so the later pages are scrolled to
            cy.get('@viewer').should(($viewer) => {
                const viewer = $viewer[0];
                const firstPage = viewer.querySelector('canvas');
                expect(viewer.clientHeight).to.be.closeTo(firstPage.getBoundingClientRect().height, 2);
                expect(viewer.scrollHeight).to.be.greaterThan(viewer.clientHeight);
            });

            // * The help text is shown below the viewer
            cy.contains('.help-text', 'Scrollable viewer of every page').scrollIntoView().should('be.visible');
        });
    });

    it('draws a later PDF page once it scrolls into the viewer', () => {
        openPreviewDialog();

        previewGroup('Inline PDF').within(() => {
            cy.findByRole('button', {name: `Open ${PDF_NAME}`}).as('viewer');

            // * The first three pages are drawn on load; the fourth waits until it is scrolled to
            cy.get('@viewer').find('canvas').should('have.length', 6).should(($canvases) => {
                expect(isDrawn($canvases[2]), 'page 3 drawn on load').to.be.true;
                expect(isDrawn($canvases[3]), 'page 4 not drawn on load').to.be.false;
            });

            // # Scroll the viewer so the top 40px of page 4 show at its bottom edge
            cy.get('@viewer').then(($viewer) => {
                const viewer = $viewer[0];
                const page = viewer.querySelectorAll('canvas')[3];
                const pageTop = (page.getBoundingClientRect().top - viewer.getBoundingClientRect().top) + viewer.scrollTop;
                viewer.scrollTop = (pageTop - viewer.clientHeight) + 40;
            });

            // * Page 4 is drawn
            cy.get('@viewer').find('canvas').eq(3).should(($canvas) => {
                expect(isDrawn($canvas[0]), 'page 4 drawn after scrolling to it').to.be.true;
            });
        });
    });

    it('renders only the first page of a PDF, cropped to max_height, for the first_page subtype', () => {
        openPreviewDialog();

        previewGroup('First page').within(() => {
            cy.findByRole('button', {name: `Open ${PDF_NAME}`}).as('viewer').
                should('have.class', 'apps-form-preview__viewer--first-page').
                and('have.css', 'max-height', '200px');

            // * Only one page is drawn, and the viewer does not scroll
            cy.get('@viewer').find('canvas').should('have.length', 1);
            cy.get('@viewer').should('have.css', 'overflow-y', 'hidden').
                invoke('outerHeight').should('be.at.most', 200);
        });
    });

    it('renders a file card for the file subtype', () => {
        openPreviewDialog();

        previewGroup('File card').within(() => {
            // * A standard file attachment card is shown instead of the PDF itself
            cy.get('.post-image__column').scrollIntoView().should('be.visible').and('contain', PDF_NAME);
            cy.get('canvas').should('not.exist');
        });
    });

    it('renders an image at its natural size, without stretching it', () => {
        openPreviewDialog();

        previewGroup('Image').within(() => {
            cy.findByRole('img', {name: IMAGE_NAME}).
                should('have.class', 'apps-form-preview__media--image').
                and(($img) => {
                    const img = $img[0];
                    expect(img.naturalWidth).to.be.greaterThan(0);

                    // The demo image is smaller than the dialog, so it is not scaled up
                    expect(img.getBoundingClientRect().width).to.be.at.most(img.naturalWidth);
                });
        });
    });

    it('shows "Preview unavailable" and requests nothing for an invalid file ID', () => {
        // # Watch for a request built from the invalid ID ("../users/me")
        cy.intercept({method: 'GET', url: '**/api/v4/users/me/info*'}).as('pathRequest');

        openPreviewDialog();

        previewGroup('Invalid file ID').within(() => {
            // * The disabled preview is named by its message, not an empty "Open" label
            cy.findByRole('button', {name: 'Preview unavailable'}).scrollIntoView().
                should('be.visible').
                and('be.disabled');
        });

        // * The other previews load, and no request was made from the invalid ID
        previewGroup('Image').find('img').scrollIntoView().should('be.visible');
        cy.get('@pathRequest.all').should('have.length', 0);
    });

    it('opens the full file in the file preview modal by click or keyboard', () => {
        openPreviewDialog();

        // # Click the inline PDF viewer
        previewGroup('Inline PDF').within(() => {
            cy.findByRole('button', {name: `Open ${PDF_NAME}`}).click();
        });

        // * The file preview modal opens on the PDF
        cy.get('.file-preview-modal').should('be.visible');
        cy.get('.file-preview-modal__file-name').should('contain', PDF_NAME);

        // # Close the modal, then open the image with Enter (realPress: cy.type('{enter}') submits the form)
        cy.get('body').type('{esc}');
        cy.get('.file-preview-modal').should('not.exist');
        previewGroup('Image').within(() => {
            cy.findByRole('button', {name: `Open ${IMAGE_NAME}`}).scrollIntoView().focus().realPress('Enter');
        });

        // * The file preview modal opens on the image
        cy.get('.file-preview-modal__file-name').should('contain', IMAGE_NAME);
    });

    it('leaves previews out of the submission', () => {
        cy.intercept('POST', '/api/v4/actions/dialogs/submit').as('submitDialog');

        openPreviewDialog();

        // # Submit the dialog
        cy.get('#appsModalSubmit').click();

        // * No preview element is submitted, and the dialog closes
        cy.wait('@submitDialog').its('request.body').should((body) => {
            expect(body.callback_id).to.eq('preview_demo');
            expect(body.submission || {}).to.not.have.any.keys('pdf_inline', 'pdf_first_page', 'pdf_file', 'image', 'invalid');
        });
        cy.get('#appsModal').should('not.exist');
    });
});
