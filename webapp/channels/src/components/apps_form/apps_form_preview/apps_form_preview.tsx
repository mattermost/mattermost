// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useId, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {FileInfo} from '@mattermost/types/files';

import {Client4} from 'mattermost-redux/client';
import {getFilePreviewUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';

import {openModal} from 'actions/views/modals';

import FileAttachment from 'components/file_attachment';
import FilePreviewModal from 'components/file_preview_modal';
import Markdown from 'components/markdown';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {FileTypes, ModalIdentifiers} from 'utils/constants';
import {ID_PATH_REGEX} from 'utils/path';
import {getFileType} from 'utils/utils';

import './apps_form_preview.scss';

// Loaded only when a preview shows a PDF, so image and file card previews don't download pdf.js.
const PDFPreview = React.lazy(() => import('components/pdf_preview'));

// Height of the scrollable PDF viewer while its first page loads, when maxHeight is unset.
// Once the first page renders, the viewer is sized to show that whole page.
const PDF_VIEWER_DEFAULT_HEIGHT = 400;

// Pages render at this scale and CSS fits them to the viewer width; 2x keeps a
// letter-size page (612pt) sharp at dialog width on high-DPI screens.
const PDF_VIEWER_SCALE = 2;

// A PDF, or an image with no preview image, over this size shows as a file card, since
// rendering it inline downloads the whole file whenever the dialog opens.
const MAX_INLINE_FILE_SIZE = 10 * 1024 * 1024;

// The viewer handles clicks itself, so PDFPreview's own click handler does nothing.
const noop = () => {};

export type PreviewMode = 'inline' | 'first_page' | 'file';

type Props = {
    fileId: string;

    // Crop height in pixels from the top; unset shows the whole image or first page.
    maxHeight?: number;

    // 'inline' (default) renders an image, or a PDF in a scrollable viewer; 'first_page'
    // shows only a PDF's first page, cropped to maxHeight; 'file' shows a standard file card.
    mode?: PreviewMode;
    label?: string;
    description?: string;
};

type Status = 'loading' | 'success' | 'fail';

// Shows a file from a dialog; clicking opens it in the file preview modal.
const AppsFormPreview: React.FC<Props> = ({fileId, maxHeight, mode = 'inline', label, description}) => {
    const firstPageOnly = mode === 'first_page';
    const dispatch = useDispatch();
    const intl = useIntl();
    const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
    const fileType = fileInfo ? getFileType(fileInfo.extension) : null;
    const tooLargeToRender = fileInfo !== null && fileInfo.size > MAX_INLINE_FILE_SIZE &&
        (fileType === FileTypes.PDF || (fileType === FileTypes.IMAGE && !fileInfo.has_preview_image));
    const asFile = mode === 'file' || tooLargeToRender;
    const [status, setStatus] = useState<Status>('loading');
    const viewerRef = useRef<HTMLDivElement>(null);
    const [firstPageAspectRatio, setFirstPageAspectRatio] = useState<number | undefined>();
    const [firstPageHeight, setFirstPageHeight] = useState<number | undefined>();
    const labelId = useId();
    const helpTextId = useId();

    const handleFirstPageRendered = useCallback((aspectRatio: number) => {
        if (aspectRatio > 0) {
            setFirstPageAspectRatio(aspectRatio);
        }
    }, []);

    // A PDF that can't be loaded falls back to the file name, like an image that fails.
    const handlePdfLoadError = useCallback(() => setStatus('fail'), []);

    // The control is named for its action ("Open file.pdf") and described by the field's
    // label and help text, which screen readers announce after the name.
    const labelElement = label ? (
        <label
            id={labelId}
            className='control-label'
        >
            {label}
        </label>
    ) : null;
    const helpTextElement = description ? (
        <div
            id={helpTextId}
            className='help-text'
        >
            <Markdown message={description}/>
        </div>
    ) : null;
    const describedBy = [label && labelId, description && helpTextId].filter(Boolean).join(' ') || undefined;

    useEffect(() => {
        let cancelled = false;
        setFileInfo(null);
        setFirstPageAspectRatio(undefined);
        setFirstPageHeight(undefined);

        // fileId comes from an integration or plugin and is put into request paths, so
        // anything other than a file ID (e.g. "../users/me") is never fetched.
        if (!ID_PATH_REGEX.test(fileId)) {
            setStatus('fail');
            return undefined;
        }
        setStatus('loading');

        Client4.getFileInfo(fileId).then((info) => {
            if (!cancelled) {
                setFileInfo(info);
            }
        }).catch(() => {
            if (!cancelled) {
                setStatus('fail');
            }
        });

        return () => {
            cancelled = true;
        };
    }, [fileId]);

    const sizeViewerToFirstPage = fileType === FileTypes.PDF && !asFile && !firstPageOnly && !maxHeight;

    // One page tall: inner width ÷ aspect ratio, plus borders. Re-measured on resize (dialog or RHS).
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!sizeViewerToFirstPage || !firstPageAspectRatio || !viewer) {
            return undefined;
        }

        const measure = () => {
            if (viewer.clientWidth) {
                const borders = viewer.offsetHeight - viewer.clientHeight;
                setFirstPageHeight(Math.ceil(viewer.clientWidth / firstPageAspectRatio) + borders);
            }
        };
        measure();

        if (typeof ResizeObserver === 'undefined') {
            return undefined;
        }
        const observer = new ResizeObserver(measure);
        observer.observe(viewer);
        return () => observer.disconnect();
    }, [sizeViewerToFirstPage, firstPageAspectRatio]);

    useEffect(() => {
        // Images report success from the <img> onLoad handler, and PDFPreview handles
        // its own loading and errors; anything else can't be shown inline.
        if (fileInfo && !asFile && fileType !== FileTypes.IMAGE && fileType !== FileTypes.PDF) {
            setStatus('fail');
        }
    }, [fileInfo, fileType, asFile]);

    const openFullPreview = useCallback(() => {
        if (!fileInfo) {
            return;
        }
        dispatch(openModal({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                fileInfos: [fileInfo],
                postId: fileInfo.post_id,
                startIndex: 0,
            },
        }));
    }, [dispatch, fileInfo]);

    if (asFile) {
        let card;
        if (fileInfo) {
            card = (
                <div className='post-image__columns clearfix'>
                    <FileAttachment
                        fileInfo={fileInfo}
                        index={0}
                        handleImageClick={openFullPreview}
                    />
                </div>
            );
        } else if (status === 'fail') {
            card = (
                <div className='apps-form-preview__error'>
                    <FormattedMessage
                        id='apps_form.preview.unavailable'
                        defaultMessage='Preview unavailable'
                    />
                </div>
            );
        } else {
            card = <LoadingSpinner/>;
        }

        return (
            <div className='form-group'>
                {labelElement}
                {card}
                {helpTextElement}
            </div>
        );
    }

    // PDF: the same viewer the file preview modal uses, one page tall unless maxHeight is set.
    if (fileInfo && fileType === FileTypes.PDF && status !== 'fail') {
        let viewerStyle;
        if (firstPageOnly) {
            viewerStyle = {maxHeight};
        } else if (maxHeight) {
            // Capped at the window height: pages count as in view anywhere inside the
            // viewer, so a viewer taller than the window would draw pages nobody can see.
            viewerStyle = {height: maxHeight, maxHeight: '100vh'};
        } else {
            viewerStyle = {height: firstPageHeight || PDF_VIEWER_DEFAULT_HEIGHT};
        }

        // A div with button semantics, since a <button> can't scroll. Space opens only a
        // first_page preview; in the scrolling viewer it pages down.
        const handleViewerKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || (e.key === ' ' && firstPageOnly)) {
                e.preventDefault();
                openFullPreview();
            }
        };

        return (
            <div className='form-group'>
                {labelElement}
                <div
                    ref={viewerRef}
                    className={firstPageOnly ? 'apps-form-preview apps-form-preview__viewer apps-form-preview__viewer--first-page' : 'apps-form-preview apps-form-preview__viewer'}
                    style={viewerStyle}
                    role='button'
                    tabIndex={0}
                    aria-label={intl.formatMessage(
                        {id: 'apps_form.preview.open', defaultMessage: 'Open {name}'},
                        {name: fileInfo.name},
                    )}
                    aria-describedby={describedBy}
                    onClick={openFullPreview}
                    onKeyDown={handleViewerKeyDown}
                    data-testid='apps-form-preview'
                >
                    <React.Suspense fallback={<LoadingSpinner/>}>
                        <PDFPreview
                            fileInfo={fileInfo}
                            fileUrl={getFileUrl(fileInfo.id)}
                            scale={PDF_VIEWER_SCALE}
                            handleBgClose={noop}
                            maxPages={firstPageOnly ? 1 : undefined}
                            onFirstPageRendered={sizeViewerToFirstPage ? handleFirstPageRendered : undefined}
                            onLoadError={handlePdfLoadError}
                        />
                    </React.Suspense>
                </div>
                {helpTextElement}
            </div>
        );
    }

    let content;
    if (status === 'fail') {
        content = (
            <div className='apps-form-preview__error'>
                {fileInfo ? fileInfo.name : intl.formatMessage({id: 'apps_form.preview.unavailable', defaultMessage: 'Preview unavailable'})}
            </div>
        );
    } else {
        content = (
            <>
                {status === 'loading' && (
                    <div className='apps-form-preview__loading'>
                        <LoadingSpinner/>
                    </div>
                )}
                {fileInfo && fileType === FileTypes.IMAGE && (
                    <img
                        className='apps-form-preview__media apps-form-preview__media--image'
                        src={fileInfo.has_preview_image ? getFilePreviewUrl(fileInfo.id) : getFileUrl(fileInfo.id)}
                        alt={fileInfo.name}
                        onLoad={() => setStatus('success')}
                        onError={() => setStatus('fail')}
                    />
                )}
            </>
        );
    }

    // Named "Open {name}" only when it can open the file; otherwise its visible text (the
    // loading spinner, the file name or "Preview unavailable") names it.
    const canOpen = Boolean(fileInfo) && status !== 'fail';

    return (
        <div className='form-group'>
            {labelElement}
            <button
                type='button'
                className='apps-form-preview'
                style={maxHeight && fileType === FileTypes.IMAGE && status !== 'fail' ? {maxHeight} : undefined}
                onClick={openFullPreview}
                disabled={!canOpen}
                aria-label={canOpen ? intl.formatMessage(
                    {id: 'apps_form.preview.open', defaultMessage: 'Open {name}'},
                    {name: fileInfo?.name ?? ''},
                ) : undefined}
                aria-describedby={describedBy}
                data-testid='apps-form-preview'
            >
                {content}
            </button>
            {helpTextElement}
        </div>
    );
};

export default AppsFormPreview;
