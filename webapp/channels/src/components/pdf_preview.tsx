// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import type {PDFDocumentProxy, PDFPageProxy} from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import 'pdfjs-dist/build/pdf.worker.min.mjs';
import type {RenderParameters} from 'pdfjs-dist/types/src/display/api';
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
}

type Status = 'success' | 'loading' | 'fail';

const PDFPreview = memo(({
    fileInfo,
    fileUrl,
    scale,
    handleBgClose,
}: Props) => {
    const pdfPagesRendered = useRef<Record<number, boolean>>({});
    const container = useRef<HTMLDivElement>(null);
    const parentNode = useRef<HTMLElement | null>(null);
    const pdfCanvasRef = useRef<{[key: string]: React.RefObject<HTMLCanvasElement>}>({});

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
        setPdfFromState({
            pdf: null,
            pages: {},
            pagesLoaded: {},
            numPages: 0,
        });

        setStatus('loading');

        const onDocumentLoad = (pdf: PDFDocumentProxy) => {
            setPdfFromState((prev) => {
                return {
                    ...prev,
                    pdf,
                    numPages: pdf.numPages,
                };
            });

            for (let i = 0; i < pdf.numPages; i++) {
                pdfCanvasRef.current[`pdfCanvasRef-${i}`] = React.createRef();
            }

            setStatus('success');
        };

        const onDocumentLoadError = (reason: string) => {
            console.log('Unable to load PDF preview: ' + reason); //eslint-disable-line no-console

            setStatus('fail');
        };

        const getPdfDocument = async () => {
            try {
                const pdf = await pdfjsLib.getDocument({
                    url: fileUrl,
                    cMapUrl: getSiteURL() + '/static/cmaps/',
                    cMapPacked: true,
                }).promise;
                onDocumentLoad(pdf);
            } catch (err) {
                onDocumentLoadError(String(err));
            }
        };

        getPdfDocument();

        /**
         * This is already initialized to an empty object above, so on mount, it's set to the same
         * initial empty object. Same for every update.
         */
        pdfPagesRendered.current = {};
    }, [fileUrl]);

    const loadPage = useCallback(async (pdf: PDFDocumentProxy, pageIndex: number) => {
        if (pdfFromState.pagesLoaded[pageIndex]) {
            return pdfFromState.pages[pageIndex];
        }

        const page = await pdf.getPage(pageIndex + 1);

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
        const bounding = page.getBoundingClientRect();
        const viewportTop = container.current?.scrollTop ?? 0;
        const viewportBottom = viewportTop + (parentNode.current?.clientHeight ?? 0);
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

        const page = await loadPage(pdfFromState.pdf!, pageIndex);
        const context = canvas.getContext('2d');
        const viewport = page.getViewport({scale});
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context as object,
            viewport,
        } as RenderParameters;

        await page.render(renderContext).promise;
        pdfPagesRendered.current[pageIndex] = true;
    }, [loadPage, pdfFromState.pdf, scale]);

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
                <LoadingSpinner/>
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
