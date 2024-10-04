// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';
import type {FileInfo} from '@mattermost/types/files';

import {removeFileUpload} from 'actions/file_actions';
import {makeGetDraft} from 'selectors/rhs';

import FilePreview from 'components/file_preview';
import type {FilePreviewInfo} from 'components/file_preview/file_preview';
import FileUpload from 'components/file_upload';
import type {FileUpload as FileUploadClass} from 'components/file_upload/file_upload';
import type TextboxClass from 'components/textbox/textbox';

import type {GlobalState} from 'types/store';

const getFileCount = (fileInfos: FileInfo[], uploadsInProgress: string[]) => {
    return fileInfos.length + uploadsInProgress.length;
};

const useUploadFiles = (
    postId: string,
    channelId: string,
    isThreadView: boolean,
    readOnlyChannel: boolean,
    textboxRef: React.RefObject<TextboxClass>,
    focusTextbox: (forceFocust?: boolean) => void,
    setServerError: (err: (ServerError & { submittedMessage?: string }) | null) => void,
): [React.ReactNode, React.ReactNode] => {
    const dispatch = useDispatch();

    const getDraftSelector = useMemo(makeGetDraft, []);
    const uploadsInProgress = useSelector((state: GlobalState) => getDraftSelector(state, channelId, postId).uploadsInProgress);
    const fileInfos = useSelector((state: GlobalState) => getDraftSelector(state, channelId, postId).fileInfos);

    const [uploadsProgressPercent, setUploadsProgressPercent] = useState<{ [clientID: string]: FilePreviewInfo }>({});

    const fileUploadRef = useRef<FileUploadClass>(null);

    const handleFileUploadChange = useCallback(() => {
        focusTextbox();
    }, [focusTextbox]);

    const getFileUploadTarget = useCallback(() => {
        return textboxRef.current?.getInputBox();
    }, [textboxRef]);

    const handleUploadProgress = useCallback((filePreviewInfo: FilePreviewInfo) => {
        setUploadsProgressPercent((prev) => ({
            ...prev,
            [filePreviewInfo.clientId]: filePreviewInfo,
        }));
    }, []);

    const handleUploadStart = useCallback(() => {
        focusTextbox();
    }, [focusTextbox]);

    const handleUploadError = useCallback((uploadError: string | ServerError | null) => {
        if (typeof uploadError === 'string') {
            if (uploadError) {
                setServerError(new Error(uploadError));
            }
        } else {
            setServerError(uploadError);
        }
    }, [setServerError]);

    const removePreview = useCallback((fileId: string) => {
        fileUploadRef.current?.cancelUpload(fileId);

        dispatch(removeFileUpload(channelId, postId, fileId));

        handleFileUploadChange();
    }, [channelId, handleFileUploadChange, postId]);

    let attachmentPreview = null;
    if (!readOnlyChannel && (fileInfos.length > 0 || uploadsInProgress.length > 0)) {
        attachmentPreview = (
            <FilePreview
                fileInfos={fileInfos}
                onRemove={removePreview}
                uploadsInProgress={uploadsInProgress}
                uploadsProgressPercent={uploadsProgressPercent}
            />
        );
    }

    let postType = 'post';
    if (postId) {
        postType = isThreadView ? 'thread' : 'comment';
    }

    const fileUploadJSX = readOnlyChannel ? null : (
        <FileUpload
            ref={fileUploadRef}
            fileCount={getFileCount(fileInfos, uploadsInProgress)}
            getTarget={getFileUploadTarget}
            onFileUploadChange={handleFileUploadChange}
            onUploadStart={handleUploadStart}
            onUploadError={handleUploadError}
            onUploadProgress={handleUploadProgress}
            rootId={postId}
            channelId={channelId}
            postType={postType}
        />
    );

    return [attachmentPreview, fileUploadJSX];
};

export default useUploadFiles;
