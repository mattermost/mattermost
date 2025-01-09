// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {PureComponent} from 'react';
import type {ChangeEvent, DragEvent, MouseEvent, TouchEvent, RefObject} from 'react';
import {defineMessages, FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import {PaperclipIcon} from '@mattermost/compass-icons/components';
import type {ServerError} from '@mattermost/types/errors';
import type {FileInfo, FileUploadResponse} from '@mattermost/types/files';

import type {UploadFile} from 'actions/file_actions';

import type {FilePreviewInfo} from 'components/file_preview/file_preview';
import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';
import WithTooltip from 'components/with_tooltip';

import Constants from 'utils/constants';
import DelayedAction from 'utils/delayed_action';
import dragster from 'utils/dragster';
import {cmdOrCtrlPressed, isKeyPressed} from 'utils/keyboard';
import {hasPlainText, createFileFromClipboardDataItem} from 'utils/paste';
import {
    isIosChrome,
    isMobileApp,
} from 'utils/user_agent';
import {
    clearFileInput,
    generateId,
    isFileTransfer,
    isUriDrop,
    localizeMessage,
    isTextDroppableEvent,
} from 'utils/utils';

import type {FilesWillUploadHook, PluginComponent} from 'types/store/plugins';

const holders = defineMessages({
    limited: {
        id: 'file_upload.limited',
        defaultMessage: 'Uploads limited to {count, number} files maximum. Please use additional posts for more files.',
    },
    filesAbove: {
        id: 'file_upload.filesAbove',
        defaultMessage: 'Files above {max}MB could not be uploaded: {filenames}',
    },
    fileAbove: {
        id: 'file_upload.fileAbove',
        defaultMessage: 'File above {max}MB could not be uploaded: {filename}',
    },
    zeroBytesFiles: {
        id: 'file_upload.zeroBytesFiles',
        defaultMessage: 'You are uploading empty files: {filenames}',
    },
    zeroBytesFile: {
        id: 'file_upload.zeroBytesFile',
        defaultMessage: 'You are uploading an empty file: {filename}',
    },
    uploadFile: {
        id: 'file_upload.upload_files',
        defaultMessage: 'Upload files',
    },
});

const OVERLAY_TIMEOUT = 500;

const customStyles = {
    left: 'inherit',
    right: 0,
    bottom: '100%',
    top: 'auto',
};

export type Props = {
    channelId: string;

    /**
     * Current root post's ID
     */
    rootId?: string;

    /**
     * Number of files to attach
     */
    fileCount: number;

    /**
     * Function to get file upload targeted input
     */
    getTarget: () => HTMLInputElement | null;

    intl: IntlShape;

    locale: string;

    /**
     * Function to be called when file upload input is clicked
     */
    onClick?: () => void;

    /**
     * Function to be called when file upload is complete
     */
    onFileUpload: (fileInfos: FileInfo[], clientIds: string[], channelId: string, currentRootId: string) => void;

    /**
     * Function to be called when file upload input's change event is fired
     */
    onFileUploadChange: () => void;

    /**
     * Function to be called when upload fails
     */
    onUploadError: (err: string | ServerError | null, clientId?: string, channelId?: string, currentRootId?: string) => void;

    /**
     * Function to be called when file upload starts
     */
    onUploadStart: (clientIds: string[], channelId: string) => void;

    /**
     * Type of the object which the uploaded file is attached to
     */
    postType: string;

    /**
     * The maximum uploaded file size.
     */
    maxFileSize: number;

    /**
     * Whether or not file upload is allowed.
     */
    canUploadFiles: boolean;

    /**
     * Plugin file upload methods to be added
     */
    pluginFileUploadMethods: PluginComponent[];
    pluginFilesWillUploadHooks: FilesWillUploadHook[];

    /**
     * Function called when xhr fires progress event.
     */
    onUploadProgress: (filePreviewInfo: FilePreviewInfo) => void;
    actions: {

        /**
         * Function to be called to upload file
         */
        uploadFile: ({file, name, type, rootId, channelId, clientId, onProgress, onSuccess, onError}: UploadFile) => XMLHttpRequest;
    };
};

type State = {
    requests: Record<string, XMLHttpRequest>;
    menuOpen: boolean;
};

export class FileUpload extends PureComponent<Props, State> {
    fileInput: RefObject<HTMLInputElement>;
    unbindDragsterEvents?: () => void;

    static defaultProps = {
        pluginFileUploadMethods: [],
        pluginFilesWillUploadHooks: [],
    };

    constructor(props: Props) {
        super(props);
        this.state = {
            requests: {},
            menuOpen: false,
        };
        this.fileInput = React.createRef();
    }

    componentDidMount() {
        if (this.props.postType === 'post') {
            this.registerDragEvents('.row.main', '.center-file-overlay');
        } else if (this.props.postType === 'comment') {
            this.registerDragEvents('.post-right__container', '.right-file-overlay');
        } else if (this.props.postType === 'thread') {
            this.registerDragEvents('.ThreadPane', '.right-file-overlay');
        }

        document.addEventListener('paste', this.pasteUpload);
        document.addEventListener('keydown', this.keyUpload);
    }

    componentWillUnmount() {
        document.removeEventListener('paste', this.pasteUpload);
        document.removeEventListener('keydown', this.keyUpload);

        this.unbindDragsterEvents?.();
    }

    fileUploadSuccess = (data: FileUploadResponse, channelId: string, currentRootId: string) => {
        if (data) {
            this.props.onFileUpload(data.file_infos, data.client_ids, channelId, currentRootId);

            const requests = Object.assign({}, this.state.requests);
            for (let j = 0; j < data.client_ids.length; j++) {
                Reflect.deleteProperty(requests, data.client_ids[j]);
            }
            this.setState({requests});
        }
    };

    fileUploadFail = (err: string | ServerError, clientId: string, channelId: string, currentRootId: string) => {
        this.props.onUploadError(err, clientId, channelId, currentRootId);
    };

    pluginUploadFiles = (files: File[]) => {
        // clear any existing errors
        this.props.onUploadError(null);
        this.uploadFiles(files);
    };

    checkPluginHooksAndUploadFiles = (files: FileList | File[]) => {
        // clear any existing errors
        this.props.onUploadError(null);

        let sortedFiles = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, this.props.locale, {numeric: true}));

        const willUploadHooks = this.props.pluginFilesWillUploadHooks;
        for (const h of willUploadHooks) {
            const result = h.hook?.(sortedFiles, this.pluginUploadFiles);

            // Display an error message if there is one but don't reject the upload
            if (result?.message) {
                this.props.onUploadError(result.message);
            }

            sortedFiles = result?.files || [];
        }

        if (sortedFiles && sortedFiles.length) {
            this.uploadFiles(sortedFiles);
        }
    };

    uploadFiles = (sortedFiles: File[]) => {
        const {channelId, rootId} = this.props;

        const uploadsRemaining = Constants.MAX_UPLOAD_FILES - this.props.fileCount;
        let numUploads = 0;

        // keep track of how many files have been too large
        const tooLargeFiles: File[] = [];
        const zeroFiles: File[] = [];
        const clientIds: string[] = [];

        for (let i = 0; i < sortedFiles.length && numUploads < uploadsRemaining; i++) {
            if (sortedFiles[i].size > this.props.maxFileSize) {
                tooLargeFiles.push(sortedFiles[i]);
                continue;
            }
            if (sortedFiles[i].size === 0) {
                zeroFiles.push(sortedFiles[i]);
            }

            // generate a unique id that can be used by other components to refer back to this upload
            const clientId = generateId();

            const request = this.props.actions.uploadFile({
                file: sortedFiles[i],
                name: sortedFiles[i].name,
                type: sortedFiles[i].type,
                rootId: rootId || '',
                channelId,
                clientId,
                onProgress: this.props.onUploadProgress,
                onSuccess: this.fileUploadSuccess,
                onError: this.fileUploadFail,
            });

            this.setState({requests: {...this.state.requests, [clientId]: request}});
            clientIds.push(clientId);

            numUploads += 1;
        }

        this.props.onUploadStart(clientIds, channelId);

        const {formatMessage} = this.props.intl;
        const errors = [];
        if (sortedFiles.length > uploadsRemaining) {
            errors.push(formatMessage(holders.limited, {count: Constants.MAX_UPLOAD_FILES}));
        }

        if (tooLargeFiles.length > 1) {
            const tooLargeFilenames = tooLargeFiles.map((file) => file.name).join(', ');

            errors.push(formatMessage(holders.filesAbove, {max: (this.props.maxFileSize / 1048576), filenames: tooLargeFilenames}));
        } else if (tooLargeFiles.length > 0) {
            errors.push(formatMessage(holders.fileAbove, {max: (this.props.maxFileSize / 1048576), filename: tooLargeFiles[0].name}));
        }

        if (zeroFiles.length > 1) {
            const zeroFilenames = zeroFiles.map((file) => file.name).join(', ');

            errors.push(formatMessage(holders.zeroBytesFiles, {filenames: zeroFilenames}));
        } else if (zeroFiles.length > 0) {
            errors.push(formatMessage(holders.zeroBytesFile, {filename: zeroFiles[0].name}));
        }

        if (errors.length > 0) {
            this.props.onUploadError(errors.join(', '));
        }
    };

    handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            this.checkPluginHooksAndUploadFiles(e.target.files);

            clearFileInput(e.target);
        }

        this.props.onFileUploadChange();
    };

    handleDrop = (e: DragEvent<HTMLInputElement>) => {
        if (!this.props.canUploadFiles) {
            this.props.onUploadError(localizeMessage({id: 'file_upload.disabled', defaultMessage: 'File attachments are disabled.'}));
            return;
        }

        this.props.onUploadError(null);

        const items = e.dataTransfer.items || [];
        const droppedFiles = e.dataTransfer.files;
        const files: File[] = [];
        Array.from(droppedFiles).forEach((file, index) => {
            const item = items[index];
            if (item && item.webkitGetAsEntry && (item.webkitGetAsEntry() === null || (item.webkitGetAsEntry() as FileSystemEntry).isDirectory)) {
                return;
            }
            files.push(file);
        });

        const types = e.dataTransfer.types;
        if (types) {
            if (isUriDrop(e.dataTransfer)) {
                return;
            }

            // For non-IE browsers
            if (types.includes && !types.includes('Files')) {
                return;
            }
        }

        if (files.length === 0) {
            this.props.onUploadError(localizeMessage({id: 'file_upload.drag_folder', defaultMessage: 'This attachment cannot be uploaded.'}));
            return;
        }

        if (files.length) {
            this.checkPluginHooksAndUploadFiles(files);
        }

        this.props.onFileUploadChange();
    };

    registerDragEvents = (containerSelector: string, overlaySelector: string) => {
        const overlay = document.querySelector(overlaySelector);

        const dragTimeout = new DelayedAction(() => {
            overlay?.classList.add('hidden');
        });

        const enter = (e: CustomEvent) => {
            const files = e.detail.dataTransfer;
            if (!isUriDrop(files) && isFileTransfer(files)) {
                overlay?.classList.remove('hidden');
            }
            e.detail.preventDefault();
        };

        const leave = (e: CustomEvent) => {
            const files = e.detail.dataTransfer;

            if (!isUriDrop(files) && isFileTransfer(files)) {
                overlay?.classList.add('hidden');
            }

            dragTimeout.cancel();

            e.detail.preventDefault();
        };

        const over = (e: CustomEvent) => {
            dragTimeout.fireAfter(OVERLAY_TIMEOUT);
            if (!isTextDroppableEvent(e.detail)) {
                e.detail.preventDefault();
            }
        };
        const dropWithHiddenClass = (e: CustomEvent) => {
            overlay?.classList.add('hidden');
            dragTimeout.cancel();

            this.handleDrop(e.detail);

            if (!isTextDroppableEvent(e.detail)) {
                e.detail.preventDefault();
            }
        };

        const drop = (e: CustomEvent) => {
            this.handleDrop(e.detail);

            if (!isTextDroppableEvent(e.detail)) {
                e.detail.preventDefault();
            }
        };

        const noop = () => {};

        let dragsterActions = {};
        if (this.props.canUploadFiles) {
            dragsterActions = {
                enter,
                leave,
                over,
                drop: dropWithHiddenClass,
            };
        } else {
            dragsterActions = {
                enter: noop,
                leave: noop,
                over: noop,
                drop,
            };
        }

        this.unbindDragsterEvents = dragster(containerSelector, dragsterActions);
    };

    containsEventTarget = (targetElement: HTMLInputElement | null, eventTarget: EventTarget | null) => targetElement && targetElement.contains(eventTarget as Node);

    /**
     * This paste handler sole responsibility is to detect if the clipboard data contains "files" and pass them to the upload file handler.
     */
    pasteUpload = (e: ClipboardEvent) => {
        // If the clipboard data doesn't contain anything or it contains plain text, do nothing and let the browser and other handlers do their thing.
        if (!e.clipboardData || !e.clipboardData.items || hasPlainText(e.clipboardData)) {
            return;
        }

        const textarea = this.props.getTarget();
        if (!this.containsEventTarget(textarea, e.target)) {
            return;
        }

        this.props.onUploadError(null);

        const fileClipboardItems = Array.
            from(e.clipboardData.items).
            filter((item) => item.kind === 'file');

        if (fileClipboardItems.length > 0) {
            if (!this.props.canUploadFiles) {
                this.props.onUploadError(this.props.intl.formatMessage({id: 'file_upload.disabled', defaultMessage: 'File attachments are disabled.'}));
                return;
            }

            const fileNamePrefixIfNoName = this.props.intl.formatMessage({id: 'file_upload.pasted', defaultMessage: 'Image Pasted at '});

            const fileList = fileClipboardItems.
                map((fileClipboardItem) => createFileFromClipboardDataItem(fileClipboardItem, fileNamePrefixIfNoName)).
                filter((file): file is NonNullable<typeof file> => file !== null);

            if (fileList.length > 0) {
                // Prevent default will stop event propagation to other handlers such as those in advanced text editor
                // so we do that here because we want to only paste the files from the clipboard and not other content.
                e.preventDefault();

                this.checkPluginHooksAndUploadFiles(fileList);
                this.props.onFileUploadChange();
            }
        }
    };

    keyUpload = (e: KeyboardEvent) => {
        if (cmdOrCtrlPressed(e) && !e.shiftKey && isKeyPressed(e, Constants.KeyCodes.U)) {
            e.preventDefault();

            if (!this.props.canUploadFiles) {
                this.props.onUploadError(localizeMessage({id: 'file_upload.disabled', defaultMessage: 'File attachments are disabled.'}));
                return;
            }
            const postTextbox = this.props.postType === 'post' && document.activeElement?.id === 'post_textbox';
            const commentTextbox = this.props.postType === 'comment' && document.activeElement?.id === 'reply_textbox';
            const threadTextbox = this.props.postType === 'thread' && document.activeElement?.id === 'reply_textbox';
            if (postTextbox || commentTextbox || threadTextbox) {
                this.fileInput.current?.focus();
                this.fileInput.current?.click();
            }
        }
    };

    cancelUpload = (clientId: string) => {
        const requests = Object.assign({}, this.state.requests);
        const request = requests[clientId];

        if (request) {
            request.abort();

            Reflect.deleteProperty(requests, clientId);
            this.setState({requests});
        }
    };

    handleMaxUploadReached = (e: MouseEvent<HTMLInputElement>) => {
        if (e) {
            e.preventDefault();
        }

        const {onUploadError} = this.props;
        const {formatMessage} = this.props.intl;

        onUploadError(formatMessage(holders.limited, {count: Constants.MAX_UPLOAD_FILES}));
    };

    handleLocalFileUploaded = (e: MouseEvent<HTMLInputElement>) => {
        const uploadsRemaining = Constants.MAX_UPLOAD_FILES - this.props.fileCount;
        if (uploadsRemaining > 0) {
            if (this.props.onClick) {
                this.props.onClick();
            }
        } else {
            this.handleMaxUploadReached(e);
        }
        this.setState({menuOpen: false});
    };

    simulateInputClick = (e: MouseEvent<HTMLButtonElement | HTMLAnchorElement> | TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.fileInput.current?.click();
    };

    render() {
        const {formatMessage} = this.props.intl;
        let multiple = true;
        if (isMobileApp()) {
            // iOS WebViews don't upload videos properly in multiple mode
            multiple = false;
        }

        let accept = '';
        if (isIosChrome()) {
            // iOS Chrome can't upload videos at all
            accept = 'image/*';
        }

        const uploadsRemaining = Constants.MAX_UPLOAD_FILES - this.props.fileCount;

        let bodyAction;
        const buttonAriaLabel = formatMessage({id: 'accessibility.button.attachment', defaultMessage: 'attachment'});
        const iconAriaLabel = formatMessage({id: 'generic_icons.attach', defaultMessage: 'Attachment Icon'});

        if (this.props.pluginFileUploadMethods.length === 0) {
            bodyAction = (
                <div>
                    <WithTooltip
                        title={
                            <KeyboardShortcutSequence
                                shortcut={KEYBOARD_SHORTCUTS.filesUpload}
                                hoistDescription={true}
                                isInsideTooltip={true}
                            />
                        }
                    >
                        <button
                            type='button'
                            id='fileUploadButton'
                            aria-label={buttonAriaLabel}
                            className={classNames('style--none AdvancedTextEditor__action-button', {
                                disabled: uploadsRemaining <= 0,
                            })}
                            onClick={this.simulateInputClick}
                            onTouchEnd={this.simulateInputClick}
                        >
                            <PaperclipIcon
                                size={18}
                                color={'currentColor'}
                                aria-label={iconAriaLabel}
                            />
                        </button>
                    </WithTooltip>
                    <input
                        id='fileUploadInput'
                        tabIndex={-1}
                        aria-label={formatMessage(holders.uploadFile)}
                        ref={this.fileInput}
                        type='file'
                        onChange={this.handleChange}
                        onClick={this.handleLocalFileUploaded}
                        multiple={multiple}
                        accept={accept}
                    />
                </div>
            );
        } else {
            const pluginFileUploadMethods = this.props.pluginFileUploadMethods.map((item) => {
                return (
                    <li
                        key={item.pluginId + '_fileuploadpluginmenuitem'}
                        onClick={() => {
                            if (item.action) {
                                item.action(this.checkPluginHooksAndUploadFiles);
                            }
                            this.setState({menuOpen: false});
                        }}
                    >
                        <a href='#'>
                            <span className='mr-2'>
                                {item.icon}
                            </span>
                            {item.text}
                        </a>
                    </li>
                );
            });
            bodyAction = (
                <div>
                    <input
                        tabIndex={-1}
                        aria-label={formatMessage(holders.uploadFile)}
                        ref={this.fileInput}
                        type='file'
                        className='file-attachment-menu-item-input'
                        onChange={this.handleChange}
                        onClick={this.handleLocalFileUploaded}
                        multiple={multiple}
                        accept={accept}
                    />
                    <MenuWrapper>
                        <WithTooltip
                            title={
                                <KeyboardShortcutSequence
                                    shortcut={KEYBOARD_SHORTCUTS.filesUpload}
                                    hoistDescription={true}
                                    isInsideTooltip={true}
                                />
                            }
                        >
                            <button
                                type='button'
                                id='fileUploadButton'
                                aria-label={buttonAriaLabel}
                                className='style--none AdvancedTextEditor__action-button'
                            >
                                <PaperclipIcon
                                    size={18}
                                    color={'currentColor'}
                                    aria-label={iconAriaLabel}
                                />
                            </button>
                        </WithTooltip>
                        <Menu
                            id='fileUploadOptions'
                            openLeft={true}
                            openUp={true}
                            ariaLabel={formatMessage({id: 'file_upload.menuAriaLabel', defaultMessage: 'Upload type selector'})}
                            customStyles={customStyles}
                        >
                            <li>
                                <a
                                    href='#'
                                    onClick={this.simulateInputClick}
                                    onTouchEnd={this.simulateInputClick}
                                >
                                    <span className='mr-2'>
                                        <i className='fa fa-laptop'/>
                                    </span>
                                    <FormattedMessage
                                        id='yourcomputer'
                                        defaultMessage='Your computer'
                                    />
                                </a>
                            </li>
                            {pluginFileUploadMethods}
                        </Menu>
                    </MenuWrapper>
                </div>
            );
        }

        if (!this.props.canUploadFiles) {
            return null;
        }

        return (
            <div className={uploadsRemaining <= 0 ? ' style--none btn-file__disabled' : 'style--none'}>
                {bodyAction}
            </div>
        );
    }
}

const wrappedComponent = injectIntl(FileUpload, {forwardRef: true});
wrappedComponent.displayName = 'injectIntl(FileUpload)';
export default wrappedComponent;
