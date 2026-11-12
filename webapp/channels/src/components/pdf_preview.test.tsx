// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import React from 'react';

// All pdfjs-dist/* imports map to the same file via moduleNameMapper.
// Use the imported reference directly — separate jest.mock() calls for different
// pdfjs paths resolve to the same key and silently overwrite each other.

import PDFPreview from 'components/pdf_preview';
import type {Props} from 'components/pdf_preview';

import {act, render, renderWithContext, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

const mockGetDocument = pdfjsLib.getDocument as jest.Mock;

// A promise the test resolves itself, to control the order async work finishes in.
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return {promise, resolve};
}

// What getDocument returns: the load, and destroy() to stop it or close the loaded document.
function loadingTask<T>(promise: Promise<T>) {
    return {promise, destroy: jest.fn(() => Promise.resolve())};
}

function mockPage(width: number, height: number) {
    return {
        getViewport: () => ({width, height}),
        render: () => ({promise: Promise.resolve()}),
    };
}

function mockDocument(numPages: number, getPage = jest.fn(() => Promise.resolve(mockPage(100, 100)))) {
    return {numPages, getPage, destroy: jest.fn(() => Promise.resolve())};
}

describe('component/PDFPreview', () => {
    const requiredProps: Props = {
        fileInfo: TestHelper.getFileInfoMock({extension: 'pdf'}),
        fileUrl: 'https://pre-release.mattermost.com/api/v4/files/ips59w4w9jnfbrs3o94m1dbdie',
        scale: 1,
        handleBgClose: jest.fn(),
    };

    beforeEach(() => {
        mockGetDocument.mockReset();
        mockGetDocument.mockReturnValue(loadingTask(Promise.resolve({
            numPages: 3,
            getPage: (i: number) => Promise.resolve({
                pageIndex: i,
                getViewport: () => ({height: 100, width: 100}),
                render: () => ({promise: Promise.resolve()}),
            }),
        })));
    });

    test('should match snapshot, loading', () => {
        const {container} = render(
            <PDFPreview {...requiredProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, not successful', async () => {
        // Mock PDF loading to fail
        mockGetDocument.mockReturnValue(loadingTask(Promise.reject(new Error('Failed to load PDF'))));

        // Use renderWithContext because FileInfoPreview requires Redux store
        const {container} = renderWithContext(
            <PDFPreview {...requiredProps}/>,
        );

        // Wait for loading to complete (and fail)
        await waitFor(() => {
            expect(container.querySelector('.view-image__loading')).not.toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should update state with new value from props when prop changes', async () => {
        const {container, rerender} = render(
            <PDFPreview {...requiredProps}/>,
        );

        // Wait for initial PDF to load
        await waitFor(() => {
            expect(container.querySelector('.post-code')).toBeInTheDocument();
        });

        const newFileUrl = 'https://some-new-url';

        // Rerender with new fileUrl - component should show loading state again
        rerender(
            <PDFPreview
                {...requiredProps}
                fileUrl={newFileUrl}
            />,
        );

        // Verify loading state is shown (state was reset due to new fileUrl)
        expect(container.querySelector('.view-image__loading')).toBeInTheDocument();

        // Wait for new PDF to load
        await waitFor(() => {
            expect(container.querySelector('.post-code')).toBeInTheDocument();
        });

        // Verify getDocument was called with new URL
        expect(mockGetDocument).toHaveBeenLastCalledWith(
            expect.objectContaining({url: newFileUrl}),
        );
    });

    test('should return correct state when onDocumentLoad is called', async () => {
        // Test with 0 pages
        mockGetDocument.mockReturnValueOnce(loadingTask(Promise.resolve({
            numPages: 0,
            getPage: jest.fn(),
        })));

        const {container, rerender} = render(
            <PDFPreview {...requiredProps}/>,
        );

        // Wait for PDF to load with 0 pages
        await waitFor(() => {
            expect(container.querySelector('.view-image__loading')).not.toBeInTheDocument();
        });

        // Should have 0 canvas elements
        expect(container.querySelectorAll('canvas')).toHaveLength(0);

        // Test with 100 pages
        mockGetDocument.mockReturnValueOnce(loadingTask(Promise.resolve({
            numPages: 100,
            getPage: (i: number) => Promise.resolve({
                pageIndex: i,
                getViewport: () => ({height: 100, width: 100}),
                render: () => ({promise: Promise.resolve()}),
            }),
        })));

        const newFileUrl = 'https://another-url';
        rerender(
            <PDFPreview
                {...requiredProps}
                fileUrl={newFileUrl}
            />,
        );

        // Wait for new PDF to load
        await waitFor(() => {
            expect(container.querySelector('.post-code')).toBeInTheDocument();
        });

        // Should have 100 canvas elements
        expect(container.querySelectorAll('canvas')).toHaveLength(100);
    });

    test('should show the latest file when an earlier file finishes loading last', async () => {
        const first = deferred<ReturnType<typeof mockDocument>>();
        const second = deferred<ReturnType<typeof mockDocument>>();
        mockGetDocument.
            mockReturnValueOnce(loadingTask(first.promise)).
            mockReturnValueOnce(loadingTask(second.promise));

        const {container, rerender} = render(<PDFPreview {...requiredProps}/>);
        rerender(
            <PDFPreview
                {...requiredProps}
                fileUrl='https://second-file'
            />,
        );

        // # The second file loads, then the first, slower request finishes
        await act(async () => second.resolve(mockDocument(2)));
        await act(async () => first.resolve(mockDocument(5)));

        // * The second file is still shown
        expect(container.querySelectorAll('canvas')).toHaveLength(2);
    });

    test('should apply the latest maxPages when an earlier load finishes last', async () => {
        const first = deferred<ReturnType<typeof mockDocument>>();
        const second = deferred<ReturnType<typeof mockDocument>>();
        mockGetDocument.
            mockReturnValueOnce(loadingTask(first.promise)).
            mockReturnValueOnce(loadingTask(second.promise));

        const {container, rerender} = render(
            <PDFPreview
                {...requiredProps}
                maxPages={1}
            />,
        );
        rerender(<PDFPreview {...requiredProps}/>);

        // # The reload without maxPages finishes, then the original load with maxPages={1}
        await act(async () => second.resolve(mockDocument(3)));
        await act(async () => first.resolve(mockDocument(3)));

        // * Every page is shown
        expect(container.querySelectorAll('canvas')).toHaveLength(3);
    });

    test('should draw the new file\'s first page, and report its size, when the old file\'s page finishes last', async () => {
        const oldPage = deferred<ReturnType<typeof mockPage>>();
        const oldDocument = mockDocument(1, jest.fn(() => oldPage.promise));
        const newDocument = mockDocument(1, jest.fn(() => Promise.resolve(mockPage(100, 200))));
        const newLoad = deferred<ReturnType<typeof mockDocument>>();
        mockGetDocument.
            mockReturnValueOnce(loadingTask(Promise.resolve(oldDocument))).
            mockReturnValueOnce(loadingTask(newLoad.promise));
        const onFirstPageRendered = jest.fn();

        const {rerender} = render(
            <PDFPreview
                {...requiredProps}
                onFirstPageRendered={onFirstPageRendered}
            />,
        );

        // # The old file starts drawing its first page, then the file changes
        await waitFor(() => expect(oldDocument.getPage).toHaveBeenCalledWith(1));
        rerender(
            <PDFPreview
                {...requiredProps}
                fileUrl='https://second-file'
                onFirstPageRendered={onFirstPageRendered}
            />,
        );

        // # The old file's page finishes after the change, then the new file loads
        await act(async () => oldPage.resolve(mockPage(200, 100)));
        await act(async () => newLoad.resolve(newDocument));

        // * The new file's first page is fetched and drawn, and only its size is reported
        await waitFor(() => expect(newDocument.getPage).toHaveBeenCalledWith(1));
        await waitFor(() => expect(onFirstPageRendered).toHaveBeenCalledWith(0.5));
        expect(onFirstPageRendered).not.toHaveBeenCalledWith(2);
    });

    test('should load PDFs with script evaluation disabled', () => {
        render(<PDFPreview {...requiredProps}/>);

        expect(mockGetDocument).toHaveBeenCalledWith(expect.objectContaining({isEvalSupported: false}));
    });

    test('should close the previous document when the file changes', async () => {
        const second = mockDocument(1);
        const firstTask = loadingTask(Promise.resolve(mockDocument(1)));
        const secondTask = loadingTask(Promise.resolve(second));
        mockGetDocument.
            mockReturnValueOnce(firstTask).
            mockReturnValueOnce(secondTask);

        const {container, rerender} = render(<PDFPreview {...requiredProps}/>);
        await waitFor(() => expect(container.querySelector('canvas')).toBeInTheDocument());

        rerender(
            <PDFPreview
                {...requiredProps}
                fileUrl='https://second-file'
            />,
        );
        await waitFor(() => expect(second.getPage).toHaveBeenCalled());

        expect(firstTask.destroy).toHaveBeenCalledTimes(1);
        expect(secondTask.destroy).not.toHaveBeenCalled();
    });

    test('should stop loading the previous file when the file changes before it loads', async () => {
        const firstLoad = deferred<ReturnType<typeof mockDocument>>();
        const firstTask = loadingTask(firstLoad.promise);
        mockGetDocument.
            mockReturnValueOnce(firstTask).
            mockReturnValueOnce(loadingTask(Promise.resolve(mockDocument(1))));

        const {container, rerender} = render(<PDFPreview {...requiredProps}/>);
        rerender(
            <PDFPreview
                {...requiredProps}
                fileUrl='https://second-file'
            />,
        );

        // * The first load is stopped straight away, not left to finish
        expect(firstTask.destroy).toHaveBeenCalledTimes(1);

        // # The stopped load finishes anyway; the new file is still shown
        await act(async () => firstLoad.resolve(mockDocument(5)));
        expect(container.querySelectorAll('canvas')).toHaveLength(1);
    });

    test('should stop loading the file when unmounted before it loads', () => {
        const task = loadingTask(deferred<ReturnType<typeof mockDocument>>().promise);
        mockGetDocument.mockReturnValueOnce(task);

        const {unmount} = render(<PDFPreview {...requiredProps}/>);
        unmount();

        expect(task.destroy).toHaveBeenCalledTimes(1);
    });

    test('should not start drawing a page again while it is still being drawn', async () => {
        // Each draw stays in progress until the test ends, as a slow page would.
        const draws = deferred<void>();
        const render = jest.fn(() => ({promise: draws.promise, cancel: jest.fn()}));
        const document = mockDocument(3, jest.fn(() => Promise.resolve({getViewport: () => ({width: 100, height: 100}), render})));
        mockGetDocument.mockReturnValueOnce(loadingTask(Promise.resolve(document)));

        renderWithContext(<PDFPreview {...requiredProps}/>);
        await waitFor(() => expect(render).toHaveBeenCalledTimes(3));

        // # Wait past the 100ms visibility check that runs after each page loads
        await act(() => new Promise((resolve) => setTimeout(resolve, 250)));

        // * Each page was drawn once, not again onto a canvas it was still drawing on
        expect(render).toHaveBeenCalledTimes(3);
        await act(async () => draws.resolve());
    });

    test('should cancel a page still being drawn and draw it again at a new scale', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});

        // Like pdf.js, cancelling a draw rejects its promise.
        let rejectFirstDraw!: (err: Error) => void;
        const firstDraw = new Promise<void>((_, reject) => {
            rejectFirstDraw = reject;
        });
        const cancel = jest.fn(() => rejectFirstDraw(new Error('Rendering cancelled, page 1')));
        const render = jest.fn().
            mockReturnValueOnce({promise: firstDraw, cancel}).
            mockReturnValue({promise: Promise.resolve(), cancel: jest.fn()});
        const document = mockDocument(1, jest.fn(() => Promise.resolve({getViewport: () => ({width: 100, height: 100}), render})));
        mockGetDocument.mockReturnValueOnce(loadingTask(Promise.resolve(document)));

        const {rerender} = renderWithContext(<PDFPreview {...requiredProps}/>);
        await waitFor(() => expect(render).toHaveBeenCalledTimes(1));

        // # Zoom while the first draw is still in progress
        rerender(
            <PDFPreview
                {...requiredProps}
                scale={2}
            />,
        );

        // * The first draw is cancelled and the page is drawn again at the new scale, without
        // the cancelled draw being reported as a failure
        await waitFor(() => expect(render).toHaveBeenCalledTimes(2));
        expect(cancel).toHaveBeenCalledTimes(1);
        await act(async () => {
            await Promise.resolve();
        });
        expect(log).not.toHaveBeenCalled();
        log.mockRestore();
    });

    test('should log a page that fails to draw and still draw the other pages', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        const good = jest.fn(() => ({promise: Promise.resolve(), cancel: jest.fn()}));
        const getPage = jest.fn((pageNumber: number) => Promise.resolve({
            getViewport: () => ({width: 100, height: 100}),
            render: pageNumber === 1 ? () => ({promise: Promise.reject(new Error('corrupt page')), cancel: jest.fn()}) : good,
        }));
        mockGetDocument.mockReturnValueOnce(loadingTask(Promise.resolve({numPages: 3, getPage})));

        renderWithContext(<PDFPreview {...requiredProps}/>);

        // * The failure is logged rather than thrown, and pages 2 and 3 are drawn
        await waitFor(() => expect(log).toHaveBeenCalledWith(expect.stringContaining('corrupt page')));
        await waitFor(() => expect(good).toHaveBeenCalledTimes(2));
        log.mockRestore();
    });

    test('should close the document when unmounted', async () => {
        const task = loadingTask(Promise.resolve(mockDocument(1)));
        mockGetDocument.mockReturnValueOnce(task);

        const {container, unmount} = render(<PDFPreview {...requiredProps}/>);
        await waitFor(() => expect(container.querySelector('canvas')).toBeInTheDocument());
        unmount();

        expect(task.destroy).toHaveBeenCalledTimes(1);
    });
});
