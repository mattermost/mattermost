// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';
import type {FileInfo} from '@mattermost/types/files';

import Permissions from 'mattermost-redux/constants/permissions';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {sortFileInfos} from 'mattermost-redux/utils/file_utils';

import {getCurrentLocale} from 'selectors/i18n';

import {useRenderPermission} from 'components/common/hooks/useRenderPermission';
import FilePreview from 'components/file_preview';
import type {FilePreviewInfo} from 'components/file_preview/file_preview';
import FileUpload from 'components/file_upload';
import type {FileUpload as FileUploadClass, TextEditorLocationType} from 'components/file_upload/file_upload';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

const getFileCount = (draft: PostDraft) => {
    return draft.fileInfos.length + draft.uploadsInProgress.length;
};

const useUploadFiles = (
    draft: PostDraft,
    postId: string,
    channelId: string,
    isThreadView: boolean,
    storedDrafts: React.MutableRefObject<Record<string, PostDraft | undefined>>,
    isDisabled: boolean,
    editorBodyRef: React.RefObject<HTMLDivElement>,
    handleDraftChange: (draft: PostDraft, options?: {instant?: boolean; show?: boolean}) => void,
    focusTextbox: (forceFocust?: boolean) => void,
    setServerError: (err: (ServerError & {submittedMessage?: string}) | null) => void,
    isPostBeingEdited?: boolean,
): [React.ReactNode, React.ReactNode] => {
    const intl = useIntl();
    const locale = useSelector(getCurrentLocale);
    const canEditAttachments = useSelector((state: GlobalState) => {
        const channel = getChannel(state, channelId);
        return channel ? haveIChannelPermission(state, channel.team_id, channel.id, Permissions.EDIT_FILE_ATTACHMENT) : true;
    });
    const editAttachmentsDisabled = isPostBeingEdited && !canEditAttachments;

    // ABAC render-time gate: disable the upload affordance (kept visible, with a
    // tooltip) when a permission policy denies upload_file_attachment for the
    // current user in this channel. This is a rendering hint only — the upload
    // endpoint still enforces server-side.
    const uploadPermission = useRenderPermission({resourceType: 'channel', resourceId: channelId, action: 'upload_file_attachment'});
    const uploadDeniedByPolicy = uploadPermission.evaluated && uploadPermission.allowed === false;

    const [uploadsProgressPercent, setUploadsProgressPercent] = useState<{[clientID: string]: FilePreviewInfo}>({});

    const fileUploadRef = useRef<FileUploadClass>(null);

    const removeTooltip = useMemo(() => {
        return editAttachmentsDisabled ? intl.formatMessage({
            id: 'file_preview.no_edit_permission',
            defaultMessage: 'Post attachments cannot be edited',
        }) : undefined;
    }, [editAttachmentsDisabled, intl]);

    const handleFileUploadChange = useCallback(() => {
        focusTextbox();
    }, [focusTextbox]);

    const getFileUploadTarget = useCallback(() => {
        return (editorBodyRef.current as unknown as HTMLInputElement | null) ?? null;
    }, [editorBodyRef]);

    const handleUploadProgress = useCallback((filePreviewInfo: FilePreviewInfo) => {
        setUploadsProgressPercent((prev) => ({
            ...prev,
            [filePreviewInfo.clientId]: filePreviewInfo,
        }));
    }, []);

    const handleFileUploadComplete = useCallback((fileInfos: FileInfo[], clientIds: string[], channelId: string, rootId?: string) => {
        const key = rootId || channelId;
        const draftToUpdate = storedDrafts.current[key];
        if (!draftToUpdate) {
            return;
        }

        const newFileInfos = sortFileInfos([...draftToUpdate.fileInfos || [], ...fileInfos], locale);

        const clientIdsSet = new Set(clientIds);
        const uploadsInProgress = (draftToUpdate.uploadsInProgress || []).filter((v) => !clientIdsSet.has(v));

        const modifiedDraft = {
            ...draftToUpdate,
            fileInfos: newFileInfos,
            uploadsInProgress,
        };

        handleDraftChange(modifiedDraft, {instant: true});
    }, [locale, handleDraftChange, storedDrafts]);

    const handleUploadStart = useCallback((clientIds: string[]) => {
        const uploadsInProgress = [...draft.uploadsInProgress, ...clientIds];

        const updatedDraft = {
            ...draft,
            uploadsInProgress,
        };

        handleDraftChange(updatedDraft, {instant: true});

        focusTextbox();
    }, [draft, handleDraftChange, focusTextbox]);

    const handleUploadError = useCallback((uploadError: string | ServerError | null, clientId?: string, channelId = '', rootId = '') => {
        if (clientId) {
            const id = rootId || channelId;
            const storedDraft = storedDrafts.current[id];
            if (storedDraft) {
                const modifiedDraft = {...storedDraft};
                const index = modifiedDraft.uploadsInProgress.indexOf(clientId) ?? -1;
                if (index !== -1) {
                    modifiedDraft.uploadsInProgress = [...modifiedDraft.uploadsInProgress];
                    modifiedDraft.uploadsInProgress.splice(index, 1);
                    handleDraftChange(modifiedDraft, {instant: true});
                }
            }
        }

        if (typeof uploadError === 'string') {
            if (uploadError) {
                setServerError(new Error(uploadError));
            }
        } else {
            setServerError(uploadError);
        }
    }, [handleDraftChange, setServerError, storedDrafts]);

    const removePreview = useCallback((clientId: string) => {
        handleUploadError(null, clientId, draft.channelId, draft.rootId);

        const modifiedDraft = {...draft};
        let index = draft.fileInfos.findIndex((info) => info.id === clientId);
        if (index === -1) {
            index = draft.uploadsInProgress.indexOf(clientId);

            if (index >= 0) {
                modifiedDraft.uploadsInProgress = [...draft.uploadsInProgress];
                modifiedDraft.uploadsInProgress.splice(index, 1);

                fileUploadRef.current?.cancelUpload(clientId);
            } else {
                // No modification
                return;
            }
        } else {
            modifiedDraft.fileInfos = [...draft.fileInfos];
            modifiedDraft.fileInfos.splice(index, 1);
        }

        handleDraftChange(modifiedDraft, {instant: true});
        handleFileUploadChange();
    }, [draft, fileUploadRef, handleDraftChange, handleUploadError, handleFileUploadChange]);

    let attachmentPreview = null;
    if (!isDisabled && (draft.fileInfos.length > 0 || draft.uploadsInProgress.length > 0)) {
        attachmentPreview = (
            <FilePreview
                fileInfos={draft.fileInfos}
                onRemove={editAttachmentsDisabled ? undefined : removePreview}
                uploadsInProgress={draft.uploadsInProgress}
                uploadsProgressPercent={uploadsProgressPercent}
                disabledRemoveTooltip={removeTooltip}
            />
        );
    }

    let postType: TextEditorLocationType = 'post';
    if (isPostBeingEdited) {
        postType = 'edit_post';
    } else if (postId) {
        postType = isThreadView ? 'thread' : 'comment';
    }

    const fileUploadJSX = (isDisabled || editAttachmentsDisabled) ? null : (
        <FileUpload
            ref={fileUploadRef}
            fileCount={getFileCount(draft)}
            getTarget={getFileUploadTarget}
            onFileUploadChange={handleFileUploadChange}
            onUploadStart={handleUploadStart}
            onFileUpload={handleFileUploadComplete}
            onUploadError={handleUploadError}
            onUploadProgress={handleUploadProgress}
            rootId={postId}
            channelId={channelId}
            postType={postType}
            forceDisabled={uploadDeniedByPolicy}
        />
    );

    return [attachmentPreview, fileUploadJSX];
};

export default useUploadFiles;
