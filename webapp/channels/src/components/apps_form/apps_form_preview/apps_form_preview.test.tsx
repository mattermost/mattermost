// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import React from 'react';

import {Client4} from 'mattermost-redux/client';
import {getFilePreviewUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';

import FilePreviewModal from 'components/file_preview_modal';

import {act, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import AppsFormPreview from './apps_form_preview';

// All pdfjs-dist/* imports map to the same mock via moduleNameMapper.
const mockGetDocument = pdfjsLib.getDocument as jest.Mock;

const mockOpenModal = jest.fn();

jest.mock('actions/views/modals', () => ({
    openModal: (...args: unknown[]) => mockOpenModal(...args),
}));

describe('AppsFormPreview', () => {
    const fileId = 'fileinfoid0000000000000000';
    let getPage: jest.Mock;

    beforeEach(() => {
        mockOpenModal.mockReset();
        mockOpenModal.mockReturnValue({type: 'MOCK_OPEN_MODAL'});

        getPage = jest.fn(() => Promise.resolve({
            getViewport: () => ({width: 100, height: 100}),
            render: () => ({promise: Promise.resolve()}),
        }));
        mockGetDocument.mockReset();
        mockGetDocument.mockReturnValue({
            promise: Promise.resolve({getPage, numPages: 1}),
            destroy: jest.fn(() => Promise.resolve()),
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('renders an image using the preview URL when the file has a preview image', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'photo.png', extension: 'png', has_preview_image: true});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(<AppsFormPreview fileId={fileId}/>);

        const img = await screen.findByRole('img', {name: 'photo.png'});
        expect(img).toHaveAttribute('src', getFilePreviewUrl(fileId));
        expect(img).toHaveClass('apps-form-preview__media--image');
        expect(Client4.getFileInfo).toHaveBeenCalledWith(fileId);
    });

    it('renders an image using the file URL when there is no preview image', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'photo.png', extension: 'png', has_preview_image: false});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(<AppsFormPreview fileId={fileId}/>);

        const img = await screen.findByRole('img', {name: 'photo.png'});
        expect(img).toHaveAttribute('src', getFileUrl(fileId));
    });

    it('crops to maxHeight when set', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, extension: 'png'});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(
            <AppsFormPreview
                fileId={fileId}
                maxHeight={300}
            />,
        );

        await screen.findByRole('img');
        expect(screen.getByTestId('apps-form-preview')).toHaveStyle({maxHeight: '300px'});
    });

    it('does not crop when maxHeight is unset', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, extension: 'png'});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(<AppsFormPreview fileId={fileId}/>);

        await screen.findByRole('img');
        expect(screen.getByTestId('apps-form-preview').style.maxHeight).toBe('');
    });

    it('renders label and description', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, extension: 'png'});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(
            <AppsFormPreview
                fileId={fileId}
                label='My label'
                description='My description'
            />,
        );

        expect(screen.getByText('My label')).toBeVisible();
        expect(screen.getByText('My description')).toBeVisible();
        await screen.findByRole('img');
    });

    it('renders a PDF in a scrollable viewer at the default height', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'doc.pdf', extension: 'pdf'});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        const {container} = renderWithContext(<AppsFormPreview fileId={fileId}/>);

        await waitFor(() => {
            expect(container.querySelector('canvas')).toBeInTheDocument();
        });
        expect(screen.getByTestId('apps-form-preview')).toHaveClass('apps-form-preview__viewer');
        expect(screen.getByTestId('apps-form-preview')).toHaveStyle({height: '400px'});
        await waitFor(() => {
            expect(getPage).toHaveBeenCalledWith(1);
        });
        expect(mockGetDocument).toHaveBeenCalledWith(expect.objectContaining({url: getFileUrl(fileId)}));
    });

    it('limits a PDF viewer with a very large maxHeight to the window height, so it does not draw every page at once', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'doc.pdf', extension: 'pdf'});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(
            <AppsFormPreview
                fileId={fileId}
                maxHeight={100000}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId('apps-form-preview')).toHaveStyle({height: '100000px', maxHeight: '100vh'});
        });
    });

    it('sizes the PDF viewer to one page once the first page renders, when maxHeight is unset', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'doc.pdf', extension: 'pdf'});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);
        mockGetDocument.mockReturnValue({
            promise: Promise.resolve({getPage, numPages: 3}),
            destroy: jest.fn(() => Promise.resolve()),
        });

        // jsdom has no layout, so give the viewer a width; the mocked page is 100x100.
        jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(500);

        renderWithContext(<AppsFormPreview fileId={fileId}/>);

        await waitFor(() => {
            expect(screen.getByTestId('apps-form-preview')).toHaveStyle({height: '500px'});
        });
    });

    it('resizes the PDF viewer to keep one whole page in view when its width changes', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'doc.pdf', extension: 'pdf'});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        let resize: (() => void) | undefined;
        const observe = jest.fn();
        const disconnect = jest.fn();
        const originalResizeObserver = window.ResizeObserver;
        window.ResizeObserver = jest.fn((callback: ResizeObserverCallback) => {
            resize = () => callback([], {} as ResizeObserver);
            return {observe, unobserve: jest.fn(), disconnect};
        }) as unknown as typeof ResizeObserver;

        // jsdom has no layout, so give the viewer a width; the mocked page is 100x100.
        const clientWidth = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(500);

        try {
            const {unmount} = renderWithContext(<AppsFormPreview fileId={fileId}/>);

            await waitFor(() => {
                expect(screen.getByTestId('apps-form-preview')).toHaveStyle({height: '500px'});
            });
            expect(observe).toHaveBeenCalledWith(screen.getByTestId('apps-form-preview'));

            // # Narrow the viewer, as when the dialog or RHS shrinks
            clientWidth.mockReturnValue(250);
            act(() => resize!());

            expect(screen.getByTestId('apps-form-preview')).toHaveStyle({height: '250px'});

            unmount();
            expect(disconnect).toHaveBeenCalled();
        } finally {
            window.ResizeObserver = originalResizeObserver;
        }
    });

    it('opens the full file from the PDF viewer by click or Enter, and labels it for screen readers', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'doc.pdf', extension: 'pdf', post_id: 'post_1'});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(<AppsFormPreview fileId={fileId}/>);

        const viewer = await screen.findByRole('button', {name: 'Open doc.pdf'});
        expect(viewer).toHaveAttribute('tabindex', '0');

        await userEvent.click(viewer);
        expect(mockOpenModal).toHaveBeenCalledTimes(1);

        viewer.focus();
        await userEvent.keyboard('{Enter}');
        expect(mockOpenModal).toHaveBeenCalledTimes(2);
        expect(mockOpenModal).toHaveBeenLastCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogProps: expect.objectContaining({fileInfos: [info]}),
        }));
    });

    it.each(['inline', 'first_page'] as const)('opens a %s PDF viewer with Space, like any button', async (mode) => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'doc.pdf', extension: 'pdf'});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(
            <AppsFormPreview
                fileId={fileId}
                mode={mode}
            />,
        );

        const viewer = await screen.findByRole('button', {name: 'Open doc.pdf'});
        viewer.focus();
        const space = new KeyboardEvent('keydown', {key: ' ', bubbles: true, cancelable: true});
        act(() => {
            viewer.dispatchEvent(space);
        });

        expect(mockOpenModal).toHaveBeenCalledTimes(1);
        expect(space.defaultPrevented).toBe(true);
    });

    it('describes the preview with its label and help text', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'photo.png', extension: 'png'});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(
            <AppsFormPreview
                fileId={fileId}
                label='Load Plan'
                description='Check the totals'
            />,
        );

        await screen.findByRole('img', {name: 'photo.png'});
        expect(screen.getByRole('button', {name: 'Open photo.png'})).toHaveAccessibleDescription('Load Plan Check the totals');
    });

    it('renders the help text as Markdown, like other dialog fields', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, extension: 'png'});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(
            <AppsFormPreview
                fileId={fileId}
                description='Check the **totals**'
            />,
        );

        await screen.findByRole('img');
        expect(screen.getByText('totals').tagName).toBe('STRONG');
    });

    it('names a preview that failed to load by its message', async () => {
        jest.spyOn(Client4, 'getFileInfo').mockRejectedValue(new Error('not found'));

        renderWithContext(<AppsFormPreview fileId={fileId}/>);

        expect(await screen.findByRole('button', {name: 'Preview unavailable'})).toBeDisabled();
    });

    it('shows the file name, with no viewer or nested link, when a PDF cannot be loaded', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'doc.pdf', extension: 'pdf'});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);
        mockGetDocument.mockReturnValue({promise: Promise.reject(new Error('Invalid PDF')), destroy: jest.fn(() => Promise.resolve())});

        renderWithContext(<AppsFormPreview fileId={fileId}/>);

        expect(await screen.findByRole('button', {name: 'doc.pdf'})).toBeDisabled();
        expect(screen.queryByRole('button', {name: 'Open doc.pdf'})).not.toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('renders only the first page of a multi-page PDF, cropped to maxHeight, in first_page mode', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'doc.pdf', extension: 'pdf'});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);
        mockGetDocument.mockReturnValue({
            promise: Promise.resolve({getPage, numPages: 3}),
            destroy: jest.fn(() => Promise.resolve()),
        });

        const {container} = renderWithContext(
            <AppsFormPreview
                fileId={fileId}
                maxHeight={300}
                mode='first_page'
            />,
        );

        await waitFor(() => {
            expect(container.querySelectorAll('canvas')).toHaveLength(1);
        });
        const viewer = screen.getByTestId('apps-form-preview');
        expect(viewer).toHaveClass('apps-form-preview__viewer--first-page');
        expect(viewer).toHaveStyle({maxHeight: '300px'});
    });

    it('shows "Preview unavailable" and disables the button when fetching file info fails', async () => {
        jest.spyOn(Client4, 'getFileInfo').mockRejectedValue(new Error('not found'));

        renderWithContext(<AppsFormPreview fileId={fileId}/>);

        expect(await screen.findByText('Preview unavailable')).toBeVisible();
        expect(screen.getByTestId('apps-form-preview')).toBeDisabled();
    });

    it('does not fetch anything for a file ID that is not a valid ID', async () => {
        jest.spyOn(Client4, 'getFileInfo');

        renderWithContext(<AppsFormPreview fileId='../users/me'/>);

        expect(await screen.findByText('Preview unavailable')).toBeVisible();
        expect(Client4.getFileInfo).not.toHaveBeenCalled();
    });

    it('shows the file name and disables the button for unsupported file types', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'report.docx', extension: 'docx'});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(<AppsFormPreview fileId={fileId}/>);

        expect(await screen.findByText('report.docx')).toBeVisible();
        expect(screen.getByTestId('apps-form-preview')).toBeDisabled();
    });

    it('ignores maxHeight for unsupported file types, so the file name is not cropped', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'report.docx', extension: 'docx'});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(
            <AppsFormPreview
                fileId={fileId}
                maxHeight={20}
            />,
        );

        expect(await screen.findByText('report.docx')).toBeVisible();
        expect(screen.getByTestId('apps-form-preview').style.maxHeight).toBe('');
    });

    it('crops an image to maxHeight', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'photo.png', extension: 'png'});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(
            <AppsFormPreview
                fileId={fileId}
                maxHeight={20}
            />,
        );

        await screen.findByRole('img', {name: 'photo.png'});
        expect(screen.getByTestId('apps-form-preview')).toHaveStyle({maxHeight: '20px'});
    });

    it('disables the button while the file info is loading', () => {
        jest.spyOn(Client4, 'getFileInfo').mockReturnValue(new Promise(() => {}));

        renderWithContext(<AppsFormPreview fileId={fileId}/>);

        expect(screen.getByTestId('apps-form-preview')).toBeDisabled();
    });

    it('opens the file preview modal with the file info when clicked after loading', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'photo.png', extension: 'png', post_id: 'post_1'});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(<AppsFormPreview fileId={fileId}/>);

        await screen.findByRole('img', {name: 'photo.png'});
        const button = screen.getByTestId('apps-form-preview');
        await waitFor(() => expect(button).toBeEnabled());

        await userEvent.click(button);

        expect(mockOpenModal).toHaveBeenCalledTimes(1);
        expect(mockOpenModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                fileInfos: [info],
                postId: 'post_1',
                startIndex: 0,
            },
        });
    });

    it('shows a file card instead of rendering inline in file mode, and opens the modal on click', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'load-plan.pdf', extension: 'pdf', post_id: 'post_1'});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(
            <AppsFormPreview
                fileId={fileId}
                mode='file'
            />,
        );

        await userEvent.click(await screen.findByRole('link', {name: 'file thumbnail load-plan.pdf'}));

        expect(screen.getByText('load-plan.pdf')).toBeInTheDocument();
        expect(screen.queryByTestId('apps-form-preview')).not.toBeInTheDocument();
        expect(mockGetDocument).not.toHaveBeenCalled();
        expect(mockOpenModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                fileInfos: [info],
                postId: 'post_1',
                startIndex: 0,
            },
        });
    });

    it('shows a PDF over 10 MB as a file card, without downloading it', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'big.pdf', extension: 'pdf', size: (10 * 1024 * 1024) + 1});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(<AppsFormPreview fileId={fileId}/>);

        expect(await screen.findByRole('link', {name: 'file thumbnail big.pdf'})).toBeInTheDocument();
        expect(screen.queryByTestId('apps-form-preview')).not.toBeInTheDocument();
        expect(mockGetDocument).not.toHaveBeenCalled();
    });

    it('still renders a PDF of exactly 10 MB in the viewer', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'doc.pdf', extension: 'pdf', size: 10 * 1024 * 1024});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(<AppsFormPreview fileId={fileId}/>);

        await waitFor(() => expect(mockGetDocument).toHaveBeenCalled());
        expect(screen.getByTestId('apps-form-preview')).toBeInTheDocument();
    });

    it('shows an image over 10 MB with no preview image as a file card, without downloading it', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'huge.png', extension: 'png', has_preview_image: false, size: (10 * 1024 * 1024) + 1});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(<AppsFormPreview fileId={fileId}/>);

        expect(await screen.findByRole('link', {name: 'file thumbnail huge.png'})).toBeInTheDocument();
        expect(screen.queryByRole('img', {name: 'huge.png'})).not.toBeInTheDocument();
    });

    it('renders an image over 10 MB inline when it has a small preview image', async () => {
        const info = TestHelper.getFileInfoMock({id: fileId, name: 'huge.png', extension: 'png', has_preview_image: true, size: (10 * 1024 * 1024) + 1});
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(info);

        renderWithContext(<AppsFormPreview fileId={fileId}/>);

        const img = await screen.findByRole('img', {name: 'huge.png'});
        expect(img).toHaveAttribute('src', getFilePreviewUrl(fileId));
    });

    it('shows "Preview unavailable" in file card mode when fetching file info fails', async () => {
        jest.spyOn(Client4, 'getFileInfo').mockRejectedValue(new Error('forbidden'));

        renderWithContext(
            <AppsFormPreview
                fileId={fileId}
                mode='file'
            />,
        );

        expect(await screen.findByText('Preview unavailable')).toBeInTheDocument();
    });
});
