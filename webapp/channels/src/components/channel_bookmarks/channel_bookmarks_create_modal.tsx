// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChangeEvent, MouseEvent, ReactNode} from 'react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {PencilOutlineIcon, CheckIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';
import type {ChannelBookmark, ChannelBookmarkCreate, ChannelBookmarkPatch} from '@mattermost/types/channel_bookmarks';
import type {FileInfo} from '@mattermost/types/files';

import {getFile} from 'mattermost-redux/selectors/entities/files';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import type {ActionResult} from 'mattermost-redux/types/actions';

import type {UploadFile} from 'actions/file_actions';
import {uploadFile} from 'actions/file_actions';

import FileAttachment from 'components/file_attachment';
import type {FilePreviewInfo} from 'components/file_preview/file_preview';
import FileProgressPreview from 'components/file_preview/file_progress_preview';
import Input from 'components/widgets/inputs/input/input';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';
import {isValidUrl, parseLink, removeScheme} from 'utils/url';
import {generateId} from 'utils/utils';

import type {GlobalState} from 'types/store';

import './bookmark_create_modal.scss';

import CreateModalNameInput from './create_modal_name_input';
import {useCanUploadFiles} from './utils';

const MAX_LINK_LENGTH = 1024;
const MAX_TITLE_LENGTH = 64;

type Props = {
    channelId: string;
    bookmarkType?: ChannelBookmark['type'];
    file?: File;
    onExited: () => void;
    onHide: () => void;
} & ({
    bookmark: ChannelBookmark;
    onConfirm: (data: ChannelBookmarkPatch) => Promise<ActionResult<boolean, any>> | ActionResult<boolean, any>;
} | {
    bookmark?: never;
    onConfirm: (data: ChannelBookmarkCreate) => Promise<ActionResult<boolean, any>> | ActionResult<boolean, any>;
});

function ChannelBookmarkCreateModal({
    bookmark,
    bookmarkType,
    file: promptedFile,
    channelId,
    onExited,
    onConfirm,
    onHide,
}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    // common
    const type = bookmark?.type ?? bookmarkType ?? 'link';
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [emoji, setEmoji] = useState(bookmark?.emoji ?? '');
    const [displayName, setDisplayName] = useState<string | undefined>(bookmark?.display_name);
    const [parsedDisplayName, setParsedDisplayName] = useState<string | undefined>();
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (isKeyPressed(event, Constants.KeyCodes.ESCAPE) && !showEmojiPicker) {
            onHide();
        }
    }, [showEmojiPicker, onHide]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    // type === 'link'
    const icon = bookmark?.image_url;
    const [link, setLinkInner] = useState(bookmark?.link_url ?? '');
    const prevLink = useRef(link);
    const [validatedLink, setValidatedLink] = useState<string>();
    const setLink = useCallback((value: string) => {
        setLinkInner((currentLink) => {
            prevLink.current = currentLink;
            return value;
        });
        if (!value) {
            setValidatedLink(undefined);
        }
    }, []);

    const [linkError, {loading: checkingLink, suppressed: linkErrorBypass}] = useBookmarkLinkValidation(link === prevLink.current ? '' : link, (validatedLink, forced) => {
        if (!forced) {
            setValidatedLink(validatedLink);
        }
        const parsed = removeScheme(validatedLink);
        setParsedDisplayName(parsed);
        setDisplayName(parsed);
    });

    const handleLinkChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const {value} = e.target;
        setLink(value);
    }, []);

    // type === 'file'
    const canUploadFiles = useCanUploadFiles();
    const [pendingFile, setPendingFile] = useState<FilePreviewInfo | null>();
    const [fileError, setFileError] = useState('');
    const [fileId, setFileId] = useState(bookmark?.file_id);
    const uploadRequestRef = useRef<XMLHttpRequest>();
    const fileInfo: FileInfo | undefined = useSelector((state: GlobalState) => (fileId && getFile(state, fileId)) || undefined);

    const maxFileSize = useSelector((state: GlobalState) => {
        const config = getConfig(state);
        return parseInt(config.MaxFileSize || '', 10);
    });
    const maxFileSizeMB = maxFileSize / 1048576;

    const handleEditFileClick = (e: MouseEvent<HTMLDivElement>) => {
        const innerClick = document.querySelector(`
            .channel-bookmarks-create-modal .post-image__download a,
            .channel-bookmarks-create-modal a.file-preview__remove
        `);
        if (
            innerClick === e.target ||
            innerClick?.contains(e.target as HTMLElement)
        ) {
            return;
        }

        fileInputRef.current?.click();
    };

    const handleFileChanged = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            return;
        }

        doUploadFile(file);
    }, []);

    const handleFileRemove = () => {
        setPendingFile(null);
        setFileId(bookmark?.file_id);
        setParsedDisplayName(undefined);
        uploadRequestRef.current?.abort();
    };

    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileInput = (
        <input
            type='file'
            id='bookmark-create-file-input-in-modal'
            className='bookmark-create-file-input'
            ref={fileInputRef}
            onChange={handleFileChanged}
        />
    );

    const onProgress: UploadFile['onProgress'] = (preview) => {
        setPendingFile(preview);
    };
    const onSuccess: UploadFile['onSuccess'] = ({file_infos: fileInfos}) => {
        setPendingFile(null);
        const newFile: FileInfo = fileInfos?.[0];
        if (newFile) {
            setFileId(newFile.id);
        }
        setFileError('');
    };
    const onError: UploadFile['onError'] = () => {
        setPendingFile(null);
        setFileError(formatMessage({id: 'file_upload.generic_error_file', defaultMessage: 'There was a problem uploading your file.'}));
    };

    const displayNameValue = displayName || parsedDisplayName || (type === 'file' ? fileInfo?.name : bookmark?.link_url) || '';

    const doUploadFile = (file: File) => {
        setPendingFile(null);
        setFileId('');

        if (file.size > maxFileSize) {
            setFileError(formatMessage({
                id: 'file_upload.fileAbove',
                defaultMessage: 'File above {max}MB could not be uploaded: {filename}',
            }, {max: maxFileSizeMB, filename: file.name}));

            return;
        }

        if (file.size === 0) {
            setFileError(formatMessage({
                id: 'file_upload.zeroBytesFile',
                defaultMessage: 'You are uploading an empty file: {filename}',
            }, {filename: file.name}));

            return;
        }

        setFileError('');
        if (displayNameValue === fileInfo?.name) {
            setDisplayName(file.name);
        }
        setParsedDisplayName(file.name);

        const clientId = generateId();

        uploadRequestRef.current = dispatch(uploadFile({
            file,
            name: file.name,
            type: file.type,
            rootId: '',
            channelId,
            clientId,
            onProgress,
            onSuccess,
            onError,
        }, true)) as unknown as XMLHttpRequest;
    };

    useEffect(() => {
        if (promptedFile) {
            doUploadFile(promptedFile);
        }
    }, [promptedFile]);

    const handleOnExited = useCallback(() => {
        uploadRequestRef.current?.abort();
        onExited?.();
    }, [onExited]);

    // controls logic
    const hasChanges = (() => {
        if (displayNameValue !== bookmark?.display_name) {
            return true;
        }

        if ((emoji || bookmark?.emoji) && emoji !== bookmark?.emoji) {
            return true;
        }

        if (type === 'file') {
            if (fileId && fileId !== bookmark?.file_id) {
                return true;
            }
        }

        if (type === 'link') {
            return Boolean(link && link !== bookmark?.link_url);
        }

        return false;
    })();
    const isValid = (() => {
        if (type === 'link') {
            if (!link || linkError) {
                return false;
            }
            if (link && linkErrorBypass) {
                return true;
            }

            if (validatedLink || link === bookmark?.link_url) {
                return true;
            }
        }

        if (type === 'file') {
            if (!fileInfo || !displayNameValue || fileError) {
                return false;
            }

            return true;
        }

        return undefined;
    })();

    const cancel = useCallback(() => {
        if (type === 'file') {
            uploadRequestRef.current?.abort();
        }
    }, [type]);

    const confirm = useCallback(async () => {
        setSaving(true);
        if (type === 'link') {
            const url = validHttpUrl(link);

            if (!url) {
                setSaveError(formatMessage(msg.linkInvalid));
                return;
            }

            let validLink = url.toString();

            if (validLink.endsWith('/')) {
                validLink = validLink.slice(0, -1);
            }

            const {data: success} = await onConfirm({
                image_url: icon,
                link_url: validLink,
                emoji,
                display_name: displayNameValue,
                type: 'link',
            });

            setSaving(false);

            if (success) {
                setSaveError('');
                onHide();
            } else {
                setSaveError(formatMessage(msg.saveError));
            }
        } else if (fileInfo) {
            const {data: success} = await onConfirm({
                file_id: fileInfo.id,
                display_name: displayNameValue,
                type: 'file',
                emoji,
            });

            if (success) {
                setSaveError('');
                onHide();
            } else {
                setSaveError(formatMessage(msg.saveError));
            }
        }
    }, [type, link, onConfirm, onHide, fileInfo, displayNameValue, emoji, icon]);

    const confirmDisabled = saving || !isValid || !hasChanges;

    let linkStatusIndicator;
    if (checkingLink) {
        // loading
        linkStatusIndicator = <LoadingSpinner/>;
    } else if (validatedLink && !linkError) {
        // validated
        linkStatusIndicator = checkedIcon;
    }

    let linkMessage = formatMessage(msg.linkInfoMessage);
    if (linkErrorBypass) {
        const url = validHttpUrl(link);
        if (url) {
            linkMessage = formatMessage(msg.invalidLinkMessage, {link: url.toString()});
        }
    }

    return (
        <GenericModal
            enforceFocus={!showEmojiPicker}
            keyboardEscape={false}
            className='channel-bookmarks-create-modal'
            modalHeaderText={formatMessage(bookmark ? msg.editHeading : msg.heading)}
            confirmButtonText={formatMessage(bookmark ? msg.saveText : msg.addBookmarkText)}
            handleCancel={cancel}
            handleConfirm={confirm}
            handleEnterKeyPress={(!confirmDisabled && confirm) || undefined}
            onExited={handleOnExited}
            compassDesign={true}
            isConfirmDisabled={confirmDisabled}
            autoCloseOnConfirmButton={false}
            errorText={saveError}
        >
            <>
                {type === 'link' ? (
                    <>
                        <Input
                            maxLength={MAX_LINK_LENGTH}
                            type='text'
                            name='bookmark-link'
                            containerClassName='linkInput'
                            placeholder={formatMessage(msg.linkPlaceholder)}
                            onChange={handleLinkChange}
                            hasError={Boolean(linkError)}
                            value={link}
                            data-testid='linkInput'
                            autoFocus={true}
                            addon={linkStatusIndicator}
                            customMessage={linkError ? {type: 'error', value: linkError} : {value: linkMessage}}
                        />
                    </>
                ) : (
                    <>
                        <FieldLabel>
                            <FormattedMessage
                                id='channel_bookmarks.create.file_input.label'
                                defaultMessage='Attachment'
                            />
                        </FieldLabel>
                        <FileInputContainer
                            tabIndex={0}
                            role='button'
                            disabled={!canUploadFiles}
                            onClick={(canUploadFiles && handleEditFileClick) || undefined}
                        >
                            {!pendingFile && fileInfo && (
                                <FileItemContainer>
                                    <FileAttachment
                                        key={fileInfo.id}
                                        fileInfo={fileInfo}
                                        index={0}
                                    />
                                </FileItemContainer>
                            )}
                            {pendingFile && (
                                <FileProgressPreview
                                    key={pendingFile.clientId}
                                    clientId={pendingFile.clientId}
                                    fileInfo={pendingFile}
                                    handleRemove={handleFileRemove}
                                />
                            )}
                            {!fileInfo && !pendingFile && (
                                <div className='file-preview__container empty'/>
                            )}
                            <VisualButton>
                                <PencilOutlineIcon size={24}/>
                                {formatMessage(msg.fileInputEdit)}
                            </VisualButton>
                            {fileInput}
                        </FileInputContainer>
                        {fileError && (
                            <div className='Input___customMessage Input___error'>
                                <i className='icon error icon-alert-circle-outline'/>
                                <span>{fileError}</span>
                            </div>
                        )}
                    </>

                )}

                <TitleWrapper>
                    <FieldLabel>
                        <FormattedMessage
                            id='channel_bookmarks.create.title_input.label'
                            defaultMessage='Title'
                        />
                    </FieldLabel>
                    <CreateModalNameInput
                        maxLength={MAX_TITLE_LENGTH}
                        type={type}
                        imageUrl={icon}
                        fileInfo={pendingFile || fileInfo}
                        emoji={emoji}
                        setEmoji={setEmoji}
                        displayName={displayName?.substring(0, MAX_TITLE_LENGTH)}
                        placeholder={displayNameValue?.substring(0, MAX_TITLE_LENGTH)}
                        setDisplayName={setDisplayName}
                        onAddCustomEmojiClick={onHide}
                        showEmojiPicker={showEmojiPicker}
                        setShowEmojiPicker={setShowEmojiPicker}
                    />
                </TitleWrapper>
            </>
        </GenericModal>
    );
}

export default ChannelBookmarkCreateModal;

const TitleWrapper = styled.div`
    margin-top: 20px;
`;

const CheckWrapper = styled.span`
    padding: 0px 12px;
    display: flex;
    align-items: center;
`;

const checkedIcon = (
    <CheckWrapper>
        <CheckIcon
            size={20}
            color='var(--sys-online-indicator)'
        />
    </CheckWrapper>
);

const FieldLabel = styled.span`
    display: inline-block;
    margin-bottom: 8px;
    font-family: Open Sans;
    font-size: 14px;
    line-height: 16px;
    font-style: normal;
    font-weight: 600;
    line-height: 20px;
`;

const VisualButton = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 10px 24px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 11px;
    font-weight: 600;
    font-family: Open Sans;
`;

const FileInputContainer = styled.div`
    display: block;
    background: rgba(var(--center-channel-color-rgb), 0.04);
    padding: 12px;
    border-radius: 8px;
    display: flex;

    &:hover:not([disabled]) {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
        cursor: pointer;
    }

    &:disabled {
        cursor: default;
        ${VisualButton} {
            opacity: 0.4;
        }
    }

    input[type="file"] {
        opacity: 0;
        width: 0;
        height: 0;
    }

    .file-preview__container,
    .file-preview {
        width: auto;
        height: auto;
        flex: 1 1 auto;
        padding: 0;

        &.empty {
            border: 2px dashed rgba(var(--center-channel-color-rgb), 0.16);
            border-radius : 4px;
        }

        .post-image__column {
            width: 100%;
            margin: 0;
        }
    }
`;

const continuableLinkErr = (url: URL, confirm: () => void) => {
    return (
        <FormattedMessage
            id='channel_bookmarks.create.error.invalid_url.continue_anyway'
            defaultMessage='Could not find: {url}. Please enter a valid link, or <Confirm>continue anyway</Confirm>.'
            values={{
                url: url.toString(),
                Confirm: (msg) => (
                    <LinkErrContinue
                        tabIndex={0}
                        onClick={confirm}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                confirm();
                            }
                        }}
                    >
                        {msg}
                    </LinkErrContinue>
                ),
            }}
        />
    );
};

const LinkErrContinue = styled.a`
    color: unset !important;
    text-decoration: underline;
`;

const FileItemContainer = styled.div`
    display: flex;
    flex: 1 1 auto;

    > div {
        width: 100%;
        margin: 0;
    }
`;

const msg = defineMessages({
    heading: {id: 'channel_bookmarks.create.title', defaultMessage: 'Add a bookmark'},
    editHeading: {id: 'channel_bookmarks.create.edit.title', defaultMessage: 'Edit bookmark'},
    linkPlaceholder: {id: 'channel_bookmarks.create.link_placeholder', defaultMessage: 'Link'},
    linkInfoMessage: {id: 'channel_bookmarks.create.link_info', defaultMessage: 'Add a link to any post, file, or any external link'},
    invalidLinkMessage: {id: 'channel_bookmarks.create.error.invalid_url.continuing_anyway', defaultMessage: 'This may not be a valid link: {link}.'},
    addBookmarkText: {id: 'channel_bookmarks.create.confirm_add.button', defaultMessage: 'Add bookmark'},
    saveText: {id: 'channel_bookmarks.create.confirm_save.button', defaultMessage: 'Save bookmark'},
    fileInputEdit: {id: 'channel_bookmarks.create.file_input.edit', defaultMessage: 'Edit'},
    linkInvalid: {id: 'channel_bookmarks.create.error.invalid_url', defaultMessage: 'Please enter a valid link. Could not parse: {link}.'},
    saveError: {id: 'channel_bookmarks.create.error.generic_save', defaultMessage: 'There was an error trying to save the bookmark.'},
});

const TYPING_DELAY_MS = 250;
const REQUEST_TIMEOUT = 10000;
export const useBookmarkLinkValidation = (link: string, onValidated: (validatedLink: string, forced?: boolean) => void) => {
    const {formatMessage} = useIntl();

    const [loading, setLoading] = useState<URL>();
    const [error, setError] = useState<ReactNode>();
    const [suppressed, setSuppressed] = useState(false);
    const abort = useRef<AbortController>();

    const start = useCallback((url: URL) => {
        setLoading(url);
        setError(undefined);
        setSuppressed(false);
        abort.current = new AbortController();
        return abort.current.signal;
    }, []);

    const cancel = useCallback(() => {
        abort.current?.abort('stale request');
        abort.current = undefined;
        setLoading(undefined);
    }, []);

    useEffect(() => {
        const handler = setTimeout(async () => {
            cancel();
            if (!link) {
                return;
            }

            const url = validHttpUrl(link);

            if (!url) {
                setError(formatMessage(msg.linkInvalid, {link}));
                setLoading(undefined);
                return;
            }

            const signal = start(url);

            try {
                await fetch(url, {
                    mode: 'no-cors',
                    signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT)]),
                });
                onValidated(link);
            } catch (err) {
                if (signal === abort.current?.signal) {
                    setError(continuableLinkErr(url, () => {
                        onValidated(link, true);
                        setSuppressed(true);
                        setError(undefined);
                    }));
                }
            } finally {
                setLoading((currentUrl) => {
                    if (currentUrl !== url) {
                        // trailing effect of cancelled
                        return currentUrl;
                    }

                    return undefined;
                });
            }
        }, TYPING_DELAY_MS);

        return () => clearTimeout(handler);
    }, [link, start, cancel]);

    return [error, {loading: Boolean(loading), suppressed}] as const;
};

export const validHttpUrl = (input: string) => {
    const val = parseLink(input);

    if (!val || !isValidUrl(val)) {
        return null;
    }

    let url;
    try {
        url = new URL(val);
    } catch {
        return null;
    }

    return url;
};
