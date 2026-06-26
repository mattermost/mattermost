// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import type {ServerError} from '@mattermost/types/errors';
import type {FileInfo} from '@mattermost/types/files';
import {MaxDialogFileIds} from '@mattermost/types/integrations';

import {logError} from 'mattermost-redux/actions/errors';
import {Client4} from 'mattermost-redux/client';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {uploadFile} from 'actions/file_actions';

import FilePreview from 'components/file_preview';
import type {FilePreviewInfo} from 'components/file_preview/file_preview';
import FileProgressPreview from 'components/file_preview/file_progress_preview';

import * as Utils from 'utils/utils';

import './apps_form_file_upload.scss';

interface FileState {
    name: string;
    stableId: string;
    clientId: string;
    status: 'selected' | 'uploading' | 'uploaded' | 'failed' | 'hydrated';
    fileId?: string;
    fileInfo?: FileInfo;
    percent?: number;
    error?: string;
}

export type Props = {
    id: string;
    label: React.ReactNode;
    helpText?: React.ReactNode;
    placeholder?: string;
    onFileSelected: (fileIds: string[]) => void;
    onPendingChange?: (hasPending: boolean) => void;
    disabled?: boolean;
    fileType?: string;
    value?: string[]; // Array of uploaded file IDs
    allowMultiple?: boolean; // Allow multiple file selection (default: false)
};

const AppsFormFileUpload: React.FC<Props> = ({
    id,
    label,
    helpText,
    placeholder,
    onFileSelected,
    onPendingChange,
    disabled = false,
    fileType = '*',
    value,
    allowMultiple = false,
}) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const currentChannelId = useSelector(getCurrentChannelId);
    const isMountedRef = useRef(true);
    const onFileSelectedRef = useRef(onFileSelected);
    onFileSelectedRef.current = onFileSelected;
    const fileObjectsRef = useRef<Map<string, File>>(new Map());
    const uploadRequestsRef = useRef<Map<string, XMLHttpRequest>>(new Map());
    const hydratedRef = useRef<Set<string>>(new Set());
    const hasInteractedRef = useRef(false);

    const [files, setFiles] = useState<FileState[]>([]);
    const filesRef = useRef<FileState[]>([]);
    filesRef.current = files;
    const [serverError, setServerError] = useState<string | undefined>(undefined);

    const maxFiles = allowMultiple ? MaxDialogFileIds : 1;

    // Derived from files state — avoids the stale-closure bug where setIsUploading(false)
    // was being called synchronously after dispatching async uploads.
    const isUploading = files.some((f) => f.status === 'uploading');

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            for (const xhr of uploadRequestsRef.current.values()) {
                xhr?.abort();
            }
            uploadRequestsRef.current.clear();
            fileObjectsRef.current.clear();
        };
    }, []);

    // Reconcile files with value prop and hydrate new IDs
    useEffect(() => {
        let cancelled = false;
        const valueSet = new Set(value ?? []);

        // Remove files whose IDs are no longer in value (parent cleared/replaced them)
        setFiles((prev) => {
            const filtered = prev.filter((f) => {
                if (f.status === 'hydrated' || f.status === 'uploaded') {
                    return f.fileId ? valueSet.has(f.fileId) : true;
                }
                return true;
            });
            if (filtered.length !== prev.length) {
                for (const f of prev) {
                    if (f.fileId && !valueSet.has(f.fileId)) {
                        hydratedRef.current.delete(f.fileId);
                    }
                }
            }
            if (filtered.length === prev.length) {
                return prev;
            }
            return filtered;
        });

        // Hydrate new IDs not already present in state
        const existingFileIds = new Set(
            filesRef.current.map((f) => f.fileId).filter((fid): fid is string => Boolean(fid)),
        );

        // Don't re-hydrate IDs that were removed by user interaction (e.g., single-file
        // replacement): the parent's value prop may still reference a just-replaced ID
        // before the new upload settles, and apps_form_field passes a fresh value array
        // each render, so this effect re-runs frequently. Once the user has interacted,
        // the files state — not the incoming value — is the source of truth.
        const newIds = hasInteractedRef.current ? [] : (value ?? []).filter((fid) => !hydratedRef.current.has(fid) && !existingFileIds.has(fid));

        if (newIds.length > 0) {
            const hydrate = async () => {
                const hydratedFiles: FileState[] = [];
                for (const fileId of newIds) {
                    try {
                        const fileInfo = await Client4.getFileInfo(fileId); // eslint-disable-line no-await-in-loop
                        if (cancelled) {
                            return;
                        }
                        hydratedFiles.push({
                            name: fileInfo.name,
                            stableId: Utils.generateId(),
                            clientId: '',
                            status: 'hydrated',
                            fileId,
                            fileInfo,
                        });
                        if (!allowMultiple && hydratedFiles.length >= maxFiles) {
                            break;
                        }
                    } catch (err: unknown) {
                        // Only skip 403/404 (deleted/inaccessible); rethrow everything else
                        const statusCode = (err && typeof err === 'object' && 'status_code' in err) ?
                            (err as {status_code: number}).status_code :
                            undefined;
                        if (statusCode !== 403 && statusCode !== 404) {
                            throw err;
                        }
                    }
                }
                if (cancelled) {
                    return;
                }
                for (const f of hydratedFiles) {
                    hydratedRef.current.add(f.fileId!);
                }
                if (hydratedFiles.length > 0) {
                    setFiles((prev) => (allowMultiple ? [...hydratedFiles, ...prev] : hydratedFiles));
                }

                // If some IDs were dropped (deleted/inaccessible), notify parent
                // with the sanitized list so it stays in sync
                if (hydratedFiles.length < newIds.length) {
                    const hydratedIds = new Set(hydratedFiles.map((f) => f.fileId!));
                    const existingIds = new Set(
                        filesRef.current.
                            filter((f) =>
                                (f.status === 'uploaded' || f.status === 'hydrated') &&
                                f.fileId &&
                                valueSet.has(f.fileId),
                            ).
                            map((f) => f.fileId!),
                    );
                    const survivingIds = (value ?? []).filter((fileId) =>
                        hydratedIds.has(fileId) || existingIds.has(fileId),
                    );
                    onFileSelectedRef.current(allowMultiple ? survivingIds : survivingIds.slice(0, maxFiles));
                }
            };
            hydrate().catch((err) => {
                if (!cancelled) {
                    const serverErr = typeof err === 'string' ? {message: err} as ServerError : err;
                    dispatch(logError(serverErr));
                    setServerError(
                        serverErr.message ??
                        formatMessage({id: 'apps_form_file_upload.hydration_failed', defaultMessage: 'Failed to load file'}),
                    );
                }
            });
        }

        return () => {
            cancelled = true;
        };
    }, [value, dispatch, formatMessage, allowMultiple, maxFiles]);

    // Notify parent dialog when files are uploading so it can block submit
    useEffect(() => {
        onPendingChange?.(isUploading);
    }, [isUploading, onPendingChange]);

    const handleChooseClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const startUpload = useCallback((file: File, stableId: string) => {
        const clientId = Utils.generateId();

        setFiles((prevFiles) => prevFiles.map((f) =>
            (f.stableId === stableId ? {...f, status: 'uploading', clientId} : f),
        ));

        const xhr = dispatch(uploadFile({
            file,
            name: file.name,
            type: file.type,
            rootId: '',
            channelId: currentChannelId || '',
            clientId,
            onProgress: (filePreviewInfo: FilePreviewInfo) => {
                if (!isMountedRef.current) {
                    return;
                }
                const percent = filePreviewInfo.percent ?? 0;
                setFiles((prev) => prev.map((f) =>
                    (f.stableId === stableId ? {...f, percent} : f),
                ));
            },
            onSuccess: (response: {file_infos: FileInfo[]}) => {
                if (!isMountedRef.current) {
                    return;
                }

                const fileInfo = response.file_infos?.[0];
                if (!fileInfo) {
                    return;
                }

                fileObjectsRef.current.delete(stableId);
                uploadRequestsRef.current.delete(stableId);

                setFiles((prevFiles) => prevFiles.map((f) =>
                    (f.stableId === stableId ? {...f, status: 'uploaded', fileId: fileInfo.id, fileInfo} : f),
                ));
            },
            onError: (err: string | ServerError) => {
                if (!isMountedRef.current) {
                    return;
                }

                fileObjectsRef.current.delete(stableId);
                uploadRequestsRef.current.delete(stableId);

                dispatch(logError(typeof err === 'string' ? {message: err} as ServerError : err));

                const errorMessage = typeof err === 'string' ? err : (err?.message ?? formatMessage({id: 'apps_form_file_upload.upload_failed', defaultMessage: 'Upload failed'}));

                setFiles((prevFiles) => prevFiles.map((f) =>
                    (f.stableId === stableId ? {...f, status: 'failed', error: errorMessage} : f),
                ));
            },
        }));
        uploadRequestsRef.current.set(stableId, xhr);
    }, [currentChannelId, dispatch, formatMessage]);

    const abortInFlightUploads = useCallback((fileStates: FileState[]) => {
        for (const f of fileStates) {
            if (f.status === 'uploading') {
                const xhr = uploadRequestsRef.current.get(f.stableId);
                if (xhr) {
                    xhr.abort();
                    uploadRequestsRef.current.delete(f.stableId);
                }
            }
            fileObjectsRef.current.delete(f.stableId);
        }
    }, []);

    const handleFileInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        hasInteractedRef.current = true;
        const selectedFiles = event.target.files;

        if (selectedFiles && selectedFiles.length > 0) {
            let filesToProcess = Array.from(selectedFiles);
            let uploadLimitError: string | undefined;

            if (allowMultiple) {
                const remaining = maxFiles - filesRef.current.length;
                if (remaining <= 0) {
                    setServerError(
                        formatMessage({
                            id: 'apps_form_file_upload.max_files',
                            defaultMessage: 'Uploads limited to {count, number} files maximum.',
                        }, {count: maxFiles}),
                    );
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                    return;
                }
                if (filesToProcess.length > remaining) {
                    uploadLimitError = formatMessage({
                        id: 'apps_form_file_upload.max_files',
                        defaultMessage: 'Uploads limited to {count, number} files maximum.',
                    }, {count: maxFiles});
                    filesToProcess = filesToProcess.slice(0, remaining);
                }
            } else {
                if (filesToProcess.length > 1) {
                    uploadLimitError = formatMessage({
                        id: 'apps_form_file_upload.max_files',
                        defaultMessage: 'Uploads limited to {count, number} files maximum.',
                    }, {count: maxFiles});
                }
                filesToProcess = filesToProcess.slice(0, maxFiles);
                abortInFlightUploads(filesRef.current);
            }

            const filesToUpload: Array<{file: File; stableId: string}> = [];

            const newFiles = filesToProcess.map((file) => {
                const stableId = Utils.generateId();
                fileObjectsRef.current.set(stableId, file);
                filesToUpload.push({file, stableId});
                return {
                    name: file.name,
                    stableId,
                    clientId: '',
                    status: 'selected' as const,
                };
            });

            setFiles(() => {
                return allowMultiple ? [...filesRef.current, ...newFiles] : newFiles;
            });

            setServerError(uploadLimitError);

            // Clear the input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            // Auto-upload immediately
            for (const {file, stableId} of filesToUpload) {
                startUpload(file, stableId);
            }
        }
    }, [allowMultiple, maxFiles, startUpload, formatMessage, abortInFlightUploads]);

    // Notify parent when uploads settle. Skips mount-time fire to avoid clobbering
    // pre-populated values before hydration completes.
    useEffect(() => {
        if (files.some((f) => f.status === 'uploading') || !hasInteractedRef.current) {
            return;
        }
        const completedFiles = files.filter((f) => (f.status === 'uploaded' || f.status === 'hydrated') && f.fileId);
        const fileIds = completedFiles.map((f) => f.fileId!);
        onFileSelectedRef.current(allowMultiple ? fileIds : fileIds.slice(0, maxFiles));
    }, [files, allowMultiple, maxFiles]);

    const handleRemoveById = useCallback((idToRemove: string) => {
        hasInteractedRef.current = true;

        // Abort any in-progress upload before updating state (side effects must stay outside updater)
        for (const f of filesRef.current) {
            if ((f.fileId === idToRemove || f.clientId === idToRemove) && f.status === 'uploading') {
                const xhr = uploadRequestsRef.current.get(f.stableId);
                if (xhr) {
                    xhr.abort();
                    uploadRequestsRef.current.delete(f.stableId);
                }
            }
        }

        setFiles((prevFiles) =>
            prevFiles.filter((f) => f.fileId !== idToRemove && f.clientId !== idToRemove),
        );
        setServerError(undefined);
    }, []);

    const uploadingFiles = files.filter((f) => f.status === 'uploading');
    const completedFiles = files.filter((f) => (f.status === 'uploaded' || f.status === 'hydrated') && f.fileInfo);
    const failedFiles = files.filter((f) => f.status === 'failed');
    const atFileLimit = allowMultiple && files.length >= maxFiles;

    return (
        <div className='form-group apps-form-file-upload'>
            <label
                htmlFor={id}
                className='control-label'
            >
                {label}
            </label>
            <div>
                {/* Uploading files — progress bars */}
                {uploadingFiles.length > 0 && (
                    <div className='file-preview__container'>
                        {uploadingFiles.map((f) => (
                            <FileProgressPreview
                                key={f.stableId}
                                clientId={f.clientId}
                                fileInfo={{clientId: f.clientId, name: f.name, percent: f.percent ?? 0, type: ''} as FilePreviewInfo}
                                handleRemove={handleRemoveById}
                            />
                        ))}
                    </div>
                )}

                {/* Completed files — standard file preview with remove button */}
                {completedFiles.length > 0 && (
                    <FilePreview
                        fileInfos={completedFiles.map((f) => f.fileInfo! as FilePreviewInfo)}
                        onRemove={handleRemoveById}
                    />
                )}

                {/* Failed files — error messages */}
                {failedFiles.length > 0 && (
                    <div className='apps-form-file-upload__errors'>
                        {failedFiles.map((f) => (
                            <div
                                key={f.stableId}
                                className='apps-form-file-upload__error-message'
                            >
                                <i className='icon icon-close apps-form-file-upload__error-icon'/>
                                <span>{f.name}{': '}{f.error}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Choose file button */}
                <div className='apps-form-file-upload__buttons'>
                    <div className='file__upload'>
                        <Button
                            type='button'
                            emphasis='tertiary'
                            disabled={disabled || isUploading || atFileLimit}
                            onClick={handleChooseClick}
                        >
                            <FormattedMessage
                                id={allowMultiple ? 'admin.file_upload.chooseFiles' : 'admin.file_upload.chooseFile'}
                                defaultMessage={allowMultiple ? 'Choose Files' : 'Choose File'}
                            />
                        </Button>
                        <input
                            ref={fileInputRef}
                            id={id}
                            type='file'
                            accept={fileType}
                            onChange={handleFileInput}
                            disabled={disabled || isUploading || atFileLimit}
                            multiple={allowMultiple}
                        />
                    </div>
                </div>

                {serverError && (
                    <div className='form-group has-error'>
                        <label className='control-label'>{serverError}</label>
                    </div>
                )}
                {helpText && (
                    <div className='help-text'>
                        {helpText}
                    </div>
                )}
                {placeholder && files.length === 0 && (
                    <div className='help-text'>
                        {placeholder}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AppsFormFileUpload;
