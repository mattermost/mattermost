// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import type {PDFDocumentProxy, PDFPageProxy} from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import 'pdfjs-dist/build/pdf.worker.min.mjs';
import type {RenderParameters} from 'pdfjs-dist/types/src/display/api';
import React, {useRef, useState, memo, useEffect} from 'react';

import type {FileInfo} from '@mattermost/types/files';

import {getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import FileInfoPreview from 'components/file_info_preview';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {getSiteURL} from 'utils/url';

import useDidUpdate from './common/hooks/useDidUpdate';

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
        pages: [],
        pagesLoaded: {},
        numPages: 0,
    });

    const [status, setStatus] = useState<Status>('loading');

    const [prevFileUrl, setPrevFileUrl] = useState('');

    const prevStatus = useRef<Status>('loading');

    useEffect(() => {
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
                onDocumentLoadError(err);
            }
        };

        getPdfDocument();

        /**
         * This is already initialized to an empty object above, so on mount, it's set to the same
         * initial empty object. Same for every update.
         */
        pdfPagesRendered.current = {};
    }, [fileUrl]);

    useEffect(() => {
        if (fileUrl !== prevFileUrl) {
            setPdfFromState({
                pdf: null,
                pages: {},
                pagesLoaded: {},
                numPages: 0,
            });

            setStatus('loading');

            setPrevFileUrl(fileUrl);
        }
    }, [fileUrl, prevFileUrl]);

    const loadPage = async (pdf: PDFDocumentProxy, pageIndex: number) => {
        if (pdfFromState.pagesLoaded[pageIndex]) {
            return pdfFromState.pages[pageIndex];
        }

        const page = await pdf.getPage(pageIndex + 1);

        const pdfPages = Object.assign({}, pdfFromState.pages);
        pdfPages[pageIndex] = page;

        const pdfPagesLoaded = Object.assign({}, pdfFromState.pagesLoaded);
        pdfPagesLoaded[pageIndex] = true;

        setPdfFromState((prev) => {
            return {
                ...prev,
                pages: pdfPages,
                pagesLoaded: pdfPagesLoaded,
            };
        });

        return page;
    };

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

    const renderPDFPage = async (pageIndex: number) => {
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
    };

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
            if (parentNode.current) {
                parentNode.current.removeEventListener('scroll', handleScroll);
            }
        };

        /* eslint-disable-next-line react-hooks/exhaustive-deps --
         * This 'useEffect' should only run once during mount.
         **/
    }, []);

    useDidUpdate(() => {
        pdfPagesRendered.current = {};

        if (status === 'success') {
            for (let i = 0; i < pdfFromState.numPages; i++) {
                renderPDFPage(i);
            }
        }
    }, [scale]);

    useDidUpdate(() => {
        if (prevStatus.current === 'fail' && status === 'success') {
            for (let i = 0; i < pdfFromState.numPages; i++) {
                renderPDFPage(i);
            }
        }

        prevStatus.current = status;
    }, [status]);

    // This function existed in the class component but wasn't used anywhere. Seek confirmation to delete during review.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const downloadFile = (e: React.FormEvent) => {
        const fileDownloadUrl = fileInfo.link || getFileDownloadUrl(fileInfo.id);
        e.preventDefault();
        window.location.href = fileDownloadUrl;
    };

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
