// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import type {PDFDocumentProxy, PDFPageProxy} from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import 'pdfjs-dist/build/pdf.worker.min.mjs';
import type {RenderParameters, RenderTask} from 'pdfjs-dist/types/src/display/api';
import React, {useRef, useState, memo, useEffect, useCallback} from 'react';

import type {FileInfo} from '@mattermost/types/files';

import FileInfoPreview from 'components/file_info_preview';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {getSiteURL} from 'utils/url';

const INITIAL_RENDERED_PAGES = 3;

export type Props = {

    /**
        * Compare file types
    */
    fileInfo: FileInfo;

    /**
        *  URL of pdf file to output and compare to update props url
    */
    fileUrl: string;
    scale: number;
    handleBgClose: (e: React.MouseEvent<Element, MouseEvent>) => void;

    // Shows at most this many pages from the start; unset shows them all.
    maxPages?: number;

    // Called after the first page renders, with its width divided by its height.
    onFirstPageRendered?: (aspectRatio: number) => void;

    // Called when the PDF can't be loaded, before the fallback file info is shown.
    onLoadError?: () => void;
};

type Status = 'success' | 'loading' | 'fail';

type PageDraw = {
    scale: number;
    task?: RenderTask;
};

const PDFPreview = memo(({
    fileInfo,
    fileUrl,
    scale,
    handleBgClose,
    maxPages,
    onFirstPageRendered,
    onLoadError,
}: Props) => {
    const pdfPagesRendered = useRef<Record<number, boolean>>({});
    const container = useRef<HTMLDivElement>(null);
    const parentNode = useRef<HTMLElement | null>(null);
    const pdfCanvasRef = useRef<{[key: string]: React.RefObject<HTMLCanvasElement | null>}>({});

    // The document currently shown. Page loads and draws started for an earlier document
    // check it after each await and stop, so a slow old file can't overwrite the new one.
    const currentPdf = useRef<PDFDocumentProxy | null>(null);

    // Pages being drawn, by index. pdf.js can't draw twice onto one canvas at once, so a draw at
    // the same scale is skipped and one at an old scale is cancelled.
    const pageDraws = useRef<Record<number, PageDraw>>({});

    // Read through a ref so a new callback doesn't reload the PDF.
    const onLoadErrorRef = useRef(onLoadError);
    useEffect(() => {
        onLoadErrorRef.current = onLoadError;
    }, [onLoadError]);

    const [pdfFromState, setPdfFromState] = useState<{
        pdf: PDFDocumentProxy | null;
        pages: Record<number, PDFPageProxy>;
        pagesLoaded: Record<number, boolean>;
        numPages: number;
    }>({
        pdf: null,
        pages: {},
        pagesLoaded: {},
        numPages: 0,
    });

    const [status, setStatus] = useState<Status>('loading');

    useEffect(() => {
        // Set by the cleanup (file change or unmount) so a stale load is dropped. Its document is
        // closed then, or on arrival if still loading, to free pdf.js memory.
        let cancelled = false;
        let loadedPdf: PDFDocumentProxy | null = null;
        const closePdf = (pdf: PDFDocumentProxy) => {
            pdf.destroy().catch(() => {});
        };
        currentPdf.current = null;

        setPdfFromState({
            pdf: null,
            pages: {},
            pagesLoaded: {},
            numPages: 0,
        });

        setStatus('loading');

        const onDocumentLoad = (pdf: PDFDocumentProxy) => {
            currentPdf.current = pdf;
            const numPages = maxPages ? Math.min(pdf.numPages, maxPages) : pdf.numPages;
            setPdfFromState((prev) => {
                return {
                    ...prev,
                    pdf,
                    numPages,
                };
            });

            for (let i = 0; i < numPages; i++) {
                pdfCanvasRef.current[`pdfCanvasRef-${i}`] = React.createRef();
            }

            setStatus('success');
        };

        const onDocumentLoadError = (reason: string) => {
            console.log('Unable to load PDF preview: ' + reason); //eslint-disable-line no-console

            setStatus('fail');
            onLoadErrorRef.current?.();
        };

        const getPdfDocument = async () => {
            try {
                const pdf = await pdfjsLib.getDocument({
                    url: fileUrl,
                    cMapUrl: getSiteURL() + '/static/cmaps/',
                    cMapPacked: true,

                    // Don't compile PDF content (fonts, functions) to JavaScript with eval.
                    // Previews can render PDFs an integration chose, without a click.
                    isEvalSupported: false,
                }).promise;
                if (cancelled) {
                    closePdf(pdf);
                    return;
                }
                loadedPdf = pdf;
                onDocumentLoad(pdf);
            } catch (err) {
                if (!cancelled) {
                    onDocumentLoadError(String(err));
                }
            }
        };

        getPdfDocument();

        /**
         * This is already initialized to an empty object above, so on mount, it's set to the same
         * initial empty object. Same for every update.
         */
        pdfPagesRendered.current = {};

        // Draws still running for the previous document stop on their own (see currentPdf),
        // so they mustn't stop the new document's pages being drawn.
        pageDraws.current = {};

        return () => {
            cancelled = true;
            if (loadedPdf) {
                closePdf(loadedPdf);
            }
        };
    }, [fileUrl, maxPages]);

    const loadPage = useCallback(async (pdf: PDFDocumentProxy, pageIndex: number) => {
        if (pdfFromState.pagesLoaded[pageIndex]) {
            return pdfFromState.pages[pageIndex];
        }

        const page = await pdf.getPage(pageIndex + 1);
        if (pdf !== currentPdf.current) {
            return page;
        }

        setPdfFromState((prev) => {
            return {
                ...prev,
                pages: {
                    ...prev.pages,
                    [pageIndex]: page,
                },
                pagesLoaded: {
                    ...prev.pagesLoaded,
                    [pageIndex]: true,
                },
            };
        });

        return page;
    }, [pdfFromState.pages, pdfFromState.pagesLoaded]);

    const isInViewport = (page: Element) => {
        // Both rects are relative to the window, so the page is compared with where the
        // scrolling parent actually sits on screen, wherever that is (a modal, a dialog).
        const bounding = page.getBoundingClientRect();
        const viewport = parentNode.current?.getBoundingClientRect();
        const viewportTop = viewport?.top ?? 0;
        const viewportBottom = viewport?.bottom ?? window.innerHeight;
        return (
            (bounding.top >= viewportTop && bounding.top <= viewportBottom) ||
            (bounding.bottom >= viewportTop && bounding.bottom <= viewportBottom) ||
            (bounding.top <= viewportTop && bounding.bottom >= viewportBottom)
        );
    };

    const renderPDFPage = useCallback(async (pageIndex: number) => {
        const canvas = pdfCanvasRef.current[`pdfCanvasRef-${pageIndex}`].current;
        if (!canvas) {
            // Refs are undefined when testing
            return;
        }

        // Always render the first INITIAL_RENDERED_PAGES pages to avoid
        // problems detecting isInViewport during the open animation
        if (pageIndex >= INITIAL_RENDERED_PAGES && !isInViewport(canvas)) {
            return;
        }

        if (pdfPagesRendered.current[pageIndex]) {
            return;
        }

        const inProgress = pageDraws.current[pageIndex];
        if (inProgress) {
            if (inProgress.scale === scale) {
                return;
            }
            inProgress.task?.cancel();
        }
        const draw: PageDraw = {scale};
        pageDraws.current[pageIndex] = draw;

        const pdf = pdfFromState.pdf!;
        let viewport;
        try {
            const page = await loadPage(pdf, pageIndex);
            if (pdf !== currentPdf.current || pageDraws.current[pageIndex] !== draw) {
                return;
            }

            const context = canvas.getContext('2d');
            viewport = page.getViewport({scale});
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context as object,
                viewport,
            } as RenderParameters;

            draw.task = page.render(renderContext);
            await draw.task.promise;
        } catch (err) {
            // A replaced document is closed, which fails its pending page loads and draws,
            // and a draw cancelled for a new scale rejects; neither is an error.
            if (pdf === currentPdf.current && pageDraws.current[pageIndex] === draw) {
                console.log(`Unable to draw PDF page ${pageIndex + 1}: ${err}`); //eslint-disable-line no-console
            }
            return;
        } finally {
            if (pageDraws.current[pageIndex] === draw) {
                delete pageDraws.current[pageIndex];
            }
        }
        if (pdf !== currentPdf.current) {
            return;
        }

        pdfPagesRendered.current[pageIndex] = true;
        if (pageIndex === 0) {
            onFirstPageRendered?.(viewport.width / viewport.height);
        }
    }, [loadPage, pdfFromState.pdf, scale, onFirstPageRendered]);

    useEffect(() => {
        const handleScroll = debounce(() => {
            if (status === 'success') {
                for (let i = 0; i < pdfFromState.numPages; i++) {
                    renderPDFPage(i);
                }
            }
        }, 100);

        if (container.current) {
            parentNode.current = container.current.parentElement;
            parentNode.current?.addEventListener('scroll', handleScroll);
        }

        // Each page load re-runs this effect, and its cleanup cancels a debounced scroll, so check
        // again now or a scroll made while pages were loading is lost.
        handleScroll();

        return () => {
            handleScroll.cancel();

            if (parentNode.current) {
                parentNode.current.removeEventListener('scroll', handleScroll);
            }
        };
    }, [pdfFromState.numPages, renderPDFPage, status]);

    const prevScale = useRef(scale);
    useEffect(() => {
        // Only re-render the pages when the user zooms in or out
        if (scale === prevScale.current) {
            return;
        }

        prevScale.current = scale;

        pdfPagesRendered.current = {};

        if (status === 'success') {
            for (let i = 0; i < pdfFromState.numPages; i++) {
                renderPDFPage(i);
            }
        }
    }, [pdfFromState.numPages, renderPDFPage, scale, status]);

    const prevStatus = useRef<Status>(status);
    useEffect(() => {
        if (prevStatus.current !== status && status === 'success') {
            for (let i = 0; i < pdfFromState.numPages; i++) {
                renderPDFPage(i);
            }
        }

        prevStatus.current = status;
    }, [pdfFromState.numPages, renderPDFPage, status]);

    if (status === 'loading') {
        return (
            <div
                ref={container}
                className='view-image__loading'
            >
                <LoadingSpinner size='24'/>
            </div>
        );
    }

    if (status === 'fail') {
        return (
            <FileInfoPreview
                fileInfo={fileInfo}
                fileUrl={fileUrl}
            />
        );
    }

    const pdfCanvases = [];
    for (let i = 0; i < pdfFromState.numPages; i++) {
        pdfCanvases.push(
            <canvas
                ref={pdfCanvasRef.current[`pdfCanvasRef-${i}`]}
                key={'previewpdfcanvas' + i}
            />,
        );

        if (i < pdfFromState.numPages - 1 && pdfFromState.numPages > 1) {
            pdfCanvases.push(
                <div
                    key={'previewpdfspacer' + i}
                    className='pdf-preview-spacer'
                />,
            );
        }
    }

    return (
        <div
            ref={container}
            className='post-code'
            data-testid='pdf-container'
            onClick={handleBgClose}
        >
            {pdfCanvases}
        </div>
    );
});

export default PDFPreview;
