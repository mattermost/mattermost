// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import type {FileInfo} from '@mattermost/types/files';
import type {Post} from '@mattermost/types/posts';

import {getFileDownloadUrl, getFilePreviewUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';

import ArchivedPreview from 'components/archived_preview';
import AudioVideoPreview from 'components/audio_video_preview';
import CodePreview, {hasSupportedLanguage} from 'components/code_preview';
import FileInfoPreview from 'components/file_info_preview';
import LoadingImagePreview from 'components/loading_image_preview';
import type {Props as PDFPreviewComponentProps} from 'components/pdf_preview';

import Constants, {FileTypes, ZoomSettings} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import * as Utils from 'utils/utils';

import type {FilePreviewComponent} from 'types/store/plugins';

import FilePreviewModalFooter from './file_preview_modal_footer/file_preview_modal_footer';
import FilePreviewModalHeader from './file_preview_modal_header/file_preview_modal_header';
import ImagePreview from './image_preview';
import PopoverBar from './popover_bar';
import {isFileInfo, isLinkInfo} from './types';
import type {LinkInfo} from './types';

import './file_preview_modal.scss';

const PDFPreview = React.lazy<React.ComponentType<PDFPreviewComponentProps>>(() => import('components/pdf_preview'));

const KeyCodes = Constants.KeyCodes;

export type Props = {
    canDownloadFiles: boolean;
    enablePublicLink: boolean;

    /**
     * List of FileInfo to view
     **/
    fileInfos: Array<FileInfo | LinkInfo>;

    isMobileView: boolean;
    pluginFilePreviewComponents: FilePreviewComponent[];
    onExited: () => void;

    /**
     * The post the files are attached to
     * Either postId or post can be passed to FilePreviewModal
     */
    post?: Post;

    /**
     * The index number of starting image
     **/
    startIndex: number;
};

type Translate = {x: number; y: number};

type State = {
    show: boolean;
    imageIndex: number;
    imageHeight: number | string;
    loaded: Record<number, boolean>;
    prevFileInfosCount: number;
    prevFileIds: string[];
    progress: Record<number, number>;
    showCloseBtn: boolean;
    showZoomControls: boolean;
    scale: Record<number, number>;
    translate: Record<number, Translate>;
    isDragging: boolean;
    content: string;
};

// Pure helper for cursor-aware zoom math. Given current scale + translate,
// the cursor position relative to the wrapper's center, and the new scale,
// returns the new translate so the image pixel under the cursor stays fixed.
export function computeZoomAtCursor(
    oldScale: number,
    oldTranslate: Translate,
    cursorOffsetX: number,
    cursorOffsetY: number,
    newScale: number,
): Translate {
    if (oldScale === 0) {
        return oldTranslate;
    }
    const ratio = newScale / oldScale;
    return {
        x: (cursorOffsetX * (1 - ratio)) + (oldTranslate.x * ratio),
        y: (cursorOffsetY * (1 - ratio)) + (oldTranslate.y * ratio),
    };
}

export default class FilePreviewModal extends React.PureComponent<Props, State> {
    static defaultProps = {
        fileInfos: [],
        startIndex: 0,
        pluginFilePreviewComponents: [],
    };

    constructor(props: Props) {
        super(props);

        this.state = {
            show: true,
            imageIndex: this.props.startIndex,
            imageHeight: '100%',
            loaded: Utils.fillRecord(false, this.props.fileInfos.length),
            prevFileInfosCount: 0,
            prevFileIds: this.props.fileInfos.map(FilePreviewModal.getFileIdentity),
            progress: Utils.fillRecord(0, this.props.fileInfos.length),
            showCloseBtn: false,
            showZoomControls: false,
            scale: this.props.fileInfos.reduce<Record<number, number>>((acc, fileInfo, index) => {
                acc[index] = FilePreviewModal.getDefaultScaleForFile(fileInfo);
                return acc;
            }, {}),
            translate: this.props.fileInfos.reduce<Record<number, Translate>>((acc, _fileInfo, index) => {
                acc[index] = {x: 0, y: 0};
                return acc;
            }, {}),
            isDragging: false,
            content: '',
        };
    }

    // Stable identity for a file used to detect same-length swaps in the
    // fileInfos prop (a websocket post update could replace one attachment
    // without changing the array length). FileInfo has an `id`, LinkInfo
    // has a `link`; fall back to extension to keep this total.
    static getFileIdentity(fileInfo: FileInfo | LinkInfo): string {
        if (isFileInfo(fileInfo)) {
            return `f:${fileInfo.id}`;
        }
        return `l:${fileInfo.link ?? fileInfo.extension ?? ''}`;
    }

    static getDefaultScaleForFile(fileInfo: FileInfo | LinkInfo): number {
        const fileType = Utils.getFileType(fileInfo.extension || '');
        if (fileType === FileTypes.IMAGE || fileType === FileTypes.SVG) {
            return ZoomSettings.DEFAULT_SCALE_IMAGE;
        }
        return ZoomSettings.DEFAULT_SCALE;
    }

    // Images get a lower zoom-in ceiling than PDFs: beyond ~2x the image
    // exceeds the modal viewport in both dimensions and panning becomes
    // tedious. PDFs keep the original 3.0 ceiling.
    static getMaxScaleForFile(fileInfo: FileInfo | LinkInfo): number {
        const fileType = Utils.getFileType(fileInfo.extension || '');
        if (fileType === FileTypes.IMAGE || fileType === FileTypes.SVG) {
            return ZoomSettings.MAX_SCALE_IMAGE;
        }
        return ZoomSettings.MAX_SCALE;
    }

    handleNext = () => {
        let id = this.state.imageIndex + 1;
        if (id > this.props.fileInfos.length - 1) {
            id = 0;
        }
        this.showImage(id);
    };

    handlePrev = () => {
        let id = this.state.imageIndex - 1;
        if (id < 0) {
            id = this.props.fileInfos.length - 1;
        }
        this.showImage(id);
    };

    handleKeyPress = (e: KeyboardEvent) => {
        if (Keyboard.isKeyPressed(e, KeyCodes.RIGHT)) {
            this.handleNext();
        } else if (Keyboard.isKeyPressed(e, KeyCodes.LEFT)) {
            this.handlePrev();
        }
    };

    // Zoom keyboard shortcuts. Bound on keydown so they fire on press (not release)
    // and feel snappy when held. Modifier keys are required to be absent so we
    // don't shadow text-editing shortcuts in any focused input.
    handleKeyDown = (e: KeyboardEvent) => {
        if (!this.state.show || !this.state.showZoomControls || e.ctrlKey || e.metaKey || e.altKey) {
            return;
        }

        // Don't hijack '+'/'='/'-'/'0' while the user is typing in an input.
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
            return;
        }
        switch (e.key) {
        case '+':
        case '=':
            e.preventDefault();
            this.handleZoomIn();
            break;
        case '-':
            e.preventDefault();
            this.handleZoomOut();
            break;
        case '0':
            e.preventDefault();
            this.handleZoomReset();
            break;
        }
    };

    componentDidMount() {
        document.addEventListener('keyup', this.handleKeyPress);
        document.addEventListener('keydown', this.handleKeyDown);

        this.showImage(this.props.startIndex);
    }

    componentWillUnmount() {
        document.removeEventListener('keyup', this.handleKeyPress);
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('mousemove', this.handleDocumentMouseMove);
        document.removeEventListener('mouseup', this.handleDocumentMouseUp);
        window.removeEventListener('blur', this.endDrag);
    }

    static getDerivedStateFromProps(props: Props, state: State) {
        const updatedState: Partial<State> = {};
        const currentFile = props.fileInfos[state.imageIndex];
        if (currentFile) {
            const extension = currentFile.extension;
            const fileType = Utils.getFileType(extension || '');
            updatedState.showZoomControls = (
                extension === FileTypes.PDF ||
                fileType === FileTypes.IMAGE ||
                fileType === FileTypes.SVG
            );
        } else {
            updatedState.showZoomControls = false;
        }

        // Detect any change to the file list — either the length, or a
        // same-index identity swap (e.g. a websocket post update replacing
        // attachment N without changing array length).
        const nextFileIds = props.fileInfos.map(FilePreviewModal.getFileIdentity);
        const lengthChanged = props.fileInfos.length !== state.prevFileInfosCount;
        const identitiesChanged = !lengthChanged && nextFileIds.some((id, i) => id !== state.prevFileIds[i]);
        if (lengthChanged || identitiesChanged) {
            updatedState.loaded = Utils.fillRecord(false, props.fileInfos.length);
            updatedState.progress = Utils.fillRecord(0, props.fileInfos.length);
            updatedState.prevFileInfosCount = props.fileInfos.length;
            updatedState.prevFileIds = nextFileIds;

            // Reconcile scale/translate per index: preserve entries whose
            // file identity is unchanged; reset to the new file's default
            // when the identity at that index changed (or is brand new).
            const nextScale: Record<number, number> = {};
            const nextTranslate: Record<number, Translate> = {};
            for (let i = 0; i < props.fileInfos.length; i++) {
                const idUnchanged = state.prevFileIds[i] === nextFileIds[i];
                nextScale[i] = idUnchanged && state.scale[i] !== undefined ?
                    state.scale[i] :
                    FilePreviewModal.getDefaultScaleForFile(props.fileInfos[i]);
                nextTranslate[i] = idUnchanged && state.translate[i] !== undefined ?
                    state.translate[i] :
                    {x: 0, y: 0};
            }
            updatedState.scale = nextScale;
            updatedState.translate = nextTranslate;
        }
        return Object.keys(updatedState).length ? updatedState : null;
    }

    showImage = (id: number) => {
        this.setState({imageIndex: id});

        const imageHeight = window.innerHeight - 100;
        this.setState({imageHeight});

        if (!this.state.loaded[id]) {
            this.loadImage(id);
        }
    };

    isImageUrl = (url: string): boolean => {
        const fileType = Utils.getFileType(url);
        return fileType === FileTypes.IMAGE || fileType === FileTypes.SVG;
    };

    private getFileTypeFromFileInfo = (fileInfo: FileInfo | LinkInfo): typeof FileTypes[keyof typeof FileTypes] => {
        if (isFileInfo(fileInfo)) {
            return Utils.getFileType(fileInfo.extension);
        }

        if (isLinkInfo(fileInfo)) {
            // if extension is not available or is longer than 5 characters, use the link to determine the file type
            const maxLenghtExtension = 11; // applescript is the longest extension
            const extensionOrLink = fileInfo.extension && fileInfo.extension.length <= maxLenghtExtension ? fileInfo.extension : fileInfo.link;
            return Utils.getFileType(extensionOrLink);
        }

        return FileTypes.OTHER;
    };

    loadImage = (index: number) => {
        const fileInfo = this.props.fileInfos[index];
        if (isFileInfo(fileInfo) && fileInfo.archived) {
            this.handleImageLoaded(index);
            return;
        }

        // Determine file type using helper method
        const fileType = this.getFileTypeFromFileInfo(fileInfo);

        // Check if this is an image
        const isImage = fileType === FileTypes.IMAGE;

        if (isImage) {
            let previewUrl = '';
            if (isFileInfo(fileInfo)) {
                if (fileInfo.has_preview_image) {
                    previewUrl = getFilePreviewUrl(fileInfo.id);
                } else {
                    // some images (eg animated gifs) just show the file itself and not a preview
                    previewUrl = getFileUrl(fileInfo.id);
                }
            } else if (isLinkInfo(fileInfo)) {
                // For LinkInfo, use the link directly
                previewUrl = fileInfo.link;
            }

            Utils.loadImage(
                previewUrl,
                () => this.handleImageLoaded(index),
                (completedPercentage) => this.handleImageProgress(index, completedPercentage),
            );
        } else {
            // there's nothing to load for non-image files
            this.handleImageLoaded(index);
        }
    };

    handleImageLoaded = (index: number) => {
        this.setState((prevState) => {
            const newState = {
                loaded: {
                    ...prevState.loaded,
                    [index]: true,
                },
            };
            return newState;
        });
    };

    handleImageProgress = (index: number, completedPercentage: number) => {
        this.setState((prevState) => {
            return {
                progress: {
                    ...prevState.progress,
                    [index]: completedPercentage,
                },
            };
        });
    };

    onMouseEnterImage = () => {
        this.setState({showCloseBtn: true});
    };

    onMouseLeaveImage = () => {
        this.setState({showCloseBtn: false});
    };

    // Apply a scale update for the current image. Auto-snaps translate to the
    // origin when the new scale equals the file's default (so the image is
    // re-centered when fully zoomed out via the reset/zoom buttons).
    setScale = (index: number, scale: number, translate?: Translate) => {
        const fileInfo = this.props.fileInfos[index];
        const defaultScale = FilePreviewModal.getDefaultScaleForFile(fileInfo);
        this.setState((prevState) => {
            const snappedTranslate = scale === defaultScale ? {x: 0, y: 0} : (translate ?? prevState.translate[index] ?? {x: 0, y: 0});
            return {
                scale: {
                    ...prevState.scale,
                    [index]: scale,
                },
                translate: {
                    ...prevState.translate,
                    [index]: snappedTranslate,
                },
            };
        });
    };

    handleZoomIn = () => {
        const fileInfo = this.props.fileInfos[this.state.imageIndex];
        const maxScale = FilePreviewModal.getMaxScaleForFile(fileInfo);
        let newScale = this.state.scale[this.state.imageIndex];
        newScale = Math.min(newScale + ZoomSettings.SCALE_DELTA, maxScale);
        this.setScale(this.state.imageIndex, newScale);
    };

    handleZoomOut = () => {
        let newScale = this.state.scale[this.state.imageIndex];
        newScale = Math.max(newScale - ZoomSettings.SCALE_DELTA, ZoomSettings.MIN_SCALE);
        this.setScale(this.state.imageIndex, newScale);
    };

    handleZoomReset = () => {
        const fileInfo = this.props.fileInfos[this.state.imageIndex];
        this.setScale(this.state.imageIndex, FilePreviewModal.getDefaultScaleForFile(fileInfo));
    };

    // Native (non-passive) wheel handler so preventDefault actually suppresses
    // the page-scroll default. Bound by ImagePreview via addEventListener.
    handleImageWheel = (e: WheelEvent) => {
        if (!this.state.showZoomControls || e.deltaY === 0) {
            return;
        }
        e.preventDefault();

        const target = e.currentTarget as HTMLElement | null;
        if (!target) {
            return;
        }
        const rect = target.getBoundingClientRect();
        const cursorOffsetX = e.clientX - rect.left - (rect.width / 2);
        const cursorOffsetY = e.clientY - rect.top - (rect.height / 2);

        // Trackpad pinch / smooth wheel emit many small deltaY events. Scale
        // the step by deltaY magnitude (capped at 1) so trackpad zoom doesn't
        // sprint past max scale in a few frames.
        const direction = e.deltaY < 0 ? 1 : -1;
        const stepMagnitude = Math.min(Math.abs(e.deltaY) / 100, 1) * ZoomSettings.SCALE_DELTA;

        this.setState((prev) => {
            const idx = prev.imageIndex;
            const fileInfo = this.props.fileInfos[idx];
            const defaultScale = FilePreviewModal.getDefaultScaleForFile(fileInfo);
            const maxScale = FilePreviewModal.getMaxScaleForFile(fileInfo);
            const oldScale = prev.scale[idx] ?? defaultScale;
            const newScale = direction > 0 ?
                Math.min(oldScale + stepMagnitude, maxScale) :
                Math.max(oldScale - stepMagnitude, ZoomSettings.MIN_SCALE);
            if (newScale === oldScale) {
                return null;
            }
            const oldTranslate = prev.translate[idx] ?? {x: 0, y: 0};
            const newTranslate = newScale === defaultScale ?
                {x: 0, y: 0} :
                computeZoomAtCursor(oldScale, oldTranslate, cursorOffsetX, cursorOffsetY, newScale);
            return {
                scale: {...prev.scale, [idx]: newScale},
                translate: {...prev.translate, [idx]: newTranslate},
            };
        });
    };

    // Drag state lives outside React state — only the resulting translate needs
    // to render, not the in-flight drag metadata.
    private dragState: {startX: number; startY: number; startTx: number; startTy: number; index: number} | null = null;

    handleImageMouseDown = (e: React.MouseEvent<HTMLElement>) => {
        if (e.button !== 0 || !this.state.showZoomControls) {
            return;
        }
        const idx = this.state.imageIndex;
        const fileInfo = this.props.fileInfos[idx];
        const defaultScale = FilePreviewModal.getDefaultScaleForFile(fileInfo);
        const currentScale = this.state.scale[idx] ?? defaultScale;

        // Only allow drag-to-pan when the image is actually zoomed in. At
        // default scale the image fits the viewport, so dragging would just
        // slide it around in empty space.
        if (currentScale <= defaultScale) {
            return;
        }
        const current = this.state.translate[idx] ?? {x: 0, y: 0};
        this.dragState = {
            startX: e.clientX,
            startY: e.clientY,
            startTx: current.x,
            startTy: current.y,
            index: idx,
        };
        document.addEventListener('mousemove', this.handleDocumentMouseMove);
        document.addEventListener('mouseup', this.handleDocumentMouseUp);
        window.addEventListener('blur', this.endDrag);
        this.setState({isDragging: true});
        e.preventDefault(); // suppress text selection / link drag-ghost
    };

    private handleDocumentMouseMove = (e: MouseEvent) => {
        if (!this.dragState) {
            return;
        }
        const {startX, startY, startTx, startTy, index} = this.dragState;
        const newTx = startTx + (e.clientX - startX);
        const newTy = startTy + (e.clientY - startY);
        this.setState((prev) => ({
            translate: {...prev.translate, [index]: {x: newTx, y: newTy}},
        }));
    };

    private handleDocumentMouseUp = () => {
        this.endDrag();
    };

    private endDrag = () => {
        if (!this.dragState) {
            return;
        }
        this.dragState = null;
        document.removeEventListener('mousemove', this.handleDocumentMouseMove);
        document.removeEventListener('mouseup', this.handleDocumentMouseUp);
        window.removeEventListener('blur', this.endDrag);
        this.setState({isDragging: false});
    };

    handleModalClose = () => {
        this.setState({show: false});
    };

    getContent = (content: string) => {
        this.setState({content});
    };

    handleBgClose = (e: React.MouseEvent) => {
        if (e.currentTarget === e.target) {
            this.handleModalClose();
        }
    };

    render() {
        if (this.props.fileInfos.length < 1 || this.props.fileInfos.length - 1 < this.state.imageIndex) {
            return null;
        }

        const fileInfo = this.props.fileInfos[this.state.imageIndex];

        // Determine file type using helper method
        const fileType = this.getFileTypeFromFileInfo(fileInfo);

        let showPublicLink;
        let fileName;
        let fileUrl;
        let fileDownloadUrl;
        let isExternalFile;
        let canCopyContent = false;
        if (isFileInfo(fileInfo)) {
            showPublicLink = true;
            fileName = fileInfo.name;
            fileUrl = getFileUrl(fileInfo.id);
            fileDownloadUrl = getFileDownloadUrl(fileInfo.id);
            isExternalFile = false;
        } else {
            showPublicLink = false;
            fileName = fileInfo.name || fileInfo.link;
            fileUrl = fileInfo.link;
            fileDownloadUrl = fileInfo.link;
            isExternalFile = true;
        }

        let dialogClassName = 'a11y__modal modal-image file-preview-modal';

        let content;
        let zoomBar;

        if (isFileInfo(fileInfo) && fileInfo.archived) {
            content = (
                <ArchivedPreview
                    fileInfo={fileInfo}
                />
            );
        }

        if (!isFileInfo(fileInfo) || !fileInfo.archived) {
            if (this.state.loaded[this.state.imageIndex]) {
                if (fileType === FileTypes.IMAGE || fileType === FileTypes.SVG) {
                    const currentScale = this.state.scale[this.state.imageIndex];
                    const currentTranslate = this.state.translate[this.state.imageIndex] ?? {x: 0, y: 0};
                    const defaultScale = FilePreviewModal.getDefaultScaleForFile(fileInfo);
                    content = (
                        <ImagePreview
                            fileInfo={fileInfo as FileInfo}
                            canDownloadFiles={this.props.canDownloadFiles}
                            scale={currentScale}
                            translate={currentTranslate}
                            onWheel={this.handleImageWheel}
                            onMouseDown={this.handleImageMouseDown}
                            isZoomed={currentScale !== defaultScale}
                            isDragging={this.state.isDragging}
                        />
                    );
                    zoomBar = (
                        <PopoverBar
                            scale={this.state.scale[this.state.imageIndex]}
                            defaultScale={ZoomSettings.DEFAULT_SCALE_IMAGE}
                            maxScale={ZoomSettings.MAX_SCALE_IMAGE}
                            showZoomControls={this.state.showZoomControls}
                            handleZoomIn={this.handleZoomIn}
                            handleZoomOut={this.handleZoomOut}
                            handleZoomReset={this.handleZoomReset}
                        />
                    );
                } else if (fileType === FileTypes.VIDEO || fileType === FileTypes.AUDIO) {
                    content = (
                        <AudioVideoPreview
                            fileInfo={fileInfo as FileInfo}
                            fileUrl={fileUrl}
                        />
                    );
                } else if (fileType === FileTypes.PDF) {
                    content = (
                        <div
                            className='file-preview-modal__scrollable'
                            onClick={this.handleBgClose}
                        >
                            <React.Suspense fallback={null}>
                                <PDFPreview
                                    fileInfo={fileInfo as FileInfo}
                                    fileUrl={fileUrl}
                                    scale={this.state.scale[this.state.imageIndex]}
                                    handleBgClose={this.handleBgClose}
                                />
                            </React.Suspense>
                        </div>
                    );
                    zoomBar = (
                        <PopoverBar
                            scale={this.state.scale[this.state.imageIndex]}
                            showZoomControls={this.state.showZoomControls}
                            handleZoomIn={this.handleZoomIn}
                            handleZoomOut={this.handleZoomOut}
                            handleZoomReset={this.handleZoomReset}
                        />
                    );
                } else if (hasSupportedLanguage(fileInfo)) {
                    dialogClassName += ' modal-code';
                    canCopyContent = true;
                    content = (
                        <CodePreview
                            fileInfo={fileInfo as FileInfo}
                            fileUrl={fileUrl}
                            getContent={this.getContent}
                        />
                    );
                } else {
                    content = (
                        <FileInfoPreview
                            fileInfo={fileInfo as FileInfo}
                            fileUrl={fileUrl}
                        />
                    );
                }
            } else {
                // display a progress indicator when the preview for an image is still loading
                const progress = Math.floor(this.state.progress[this.state.imageIndex]);

                content = (
                    <LoadingImagePreview
                        loading={
                            <FormattedMessage
                                id='view_image.loading'
                                defaultMessage='Loading'
                            />
                        }
                        progress={progress}
                    />
                );
            }
        }

        if (isFileInfo(fileInfo) && !fileInfo.archived) {
            for (const preview of this.props.pluginFilePreviewComponents) {
                if (preview.override(fileInfo, this.props.post)) {
                    content = (
                        <preview.component
                            fileInfo={fileInfo}
                            post={this.props.post}
                            onModalDismissed={this.handleModalClose}
                        />
                    );
                    break;
                }
            }
        }

        return (
            <Modal
                show={this.state.show}
                onHide={this.handleModalClose}
                onExited={this.props.onExited}
                className='modal-image file-preview-modal'
                dialogClassName={dialogClassName}
                animation={true}
                backdrop={false}
                role='none'
                style={{paddingLeft: 0}}
                aria-labelledby='viewImageModalLabel'
            >
                <Modal.Body className='file-preview-modal__body'>
                    <div
                        className={'modal-image__wrapper'}
                        onClick={this.handleModalClose}
                    >
                        <div
                            className='file-preview-modal__main-ctr'
                            onMouseEnter={this.onMouseEnterImage}
                            onMouseLeave={this.onMouseLeaveImage}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Modal.Title
                                componentClass='div'
                                id='viewImageModalLabel'
                                className='file-preview-modal__title'
                            >
                                <FilePreviewModalHeader
                                    isMobileView={this.props.isMobileView}
                                    post={this.props.post!}
                                    showPublicLink={showPublicLink}
                                    fileIndex={this.state.imageIndex}
                                    totalFiles={this.props.fileInfos?.length}
                                    filename={fileName}
                                    fileURL={fileDownloadUrl}
                                    fileInfo={fileInfo}
                                    enablePublicLink={this.props.enablePublicLink}
                                    canDownloadFiles={this.props.canDownloadFiles}
                                    canCopyContent={canCopyContent}
                                    isExternalFile={isExternalFile}
                                    handlePrev={this.handlePrev}
                                    handleNext={this.handleNext}
                                    handleModalClose={this.handleModalClose}
                                    content={this.state.content}
                                />
                                {zoomBar}
                            </Modal.Title>
                            <div
                                className={classNames(
                                    'file-preview-modal__content',
                                    {
                                        'file-preview-modal__content-scrollable': (!isFileInfo(fileInfo) || !fileInfo.archived) && this.state.loaded[this.state.imageIndex] && (fileType === FileTypes.PDF),
                                    },
                                )}
                                onClick={this.handleBgClose}
                            >
                                {content}
                            </div>
                            { this.props.isMobileView &&
                                <FilePreviewModalFooter
                                    post={this.props.post}
                                    showPublicLink={showPublicLink}
                                    filename={fileName}
                                    fileURL={fileDownloadUrl}
                                    fileInfo={fileInfo}
                                    enablePublicLink={this.props.enablePublicLink}
                                    canDownloadFiles={this.props.canDownloadFiles}
                                    canCopyContent={canCopyContent}
                                    isExternalFile={isExternalFile}
                                    handleModalClose={this.handleModalClose}
                                    content={this.state.content}
                                />
                            }
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
        );
    }
}
