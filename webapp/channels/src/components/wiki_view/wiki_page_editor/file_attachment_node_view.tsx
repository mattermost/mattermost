// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {NodeViewProps} from '@tiptap/react';
import {NodeViewWrapper} from '@tiptap/react';
import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {openModal} from 'actions/views/modals';

import FilePreviewModal from 'components/file_preview_modal';

import {ModalIdentifiers} from 'utils/constants';
import {getFileTypeFromMime} from 'utils/file_utils';
import {fileSizeToString, getCompassIconClassName} from 'utils/utils';

import './file_attachment_node_view.scss';

type FileAttachmentNodeViewProps = NodeViewProps;

const MIME_TO_EXTENSION_MAP: Record<string, string> = {
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'application/json': 'json',
    'application/xml': 'xml',
} as const;

const FileAttachmentNodeView = ({node, deleteNode, selected, editor}: FileAttachmentNodeViewProps) => {
    const {fileId, fileName, fileSize, mimeType, src, loading} = node.attrs;
    const intl = useIntl();
    const dispatch = useDispatch();
    const isEditable = editor?.isEditable ?? false;

    const openPreviewModal = useCallback(() => {
        if (!src || loading) {
            return;
        }

        // Extract extension from fileName or mimeType
        let extension = '';
        if (fileName) {
            const lastDotIndex = fileName.lastIndexOf('.');
            if (lastDotIndex !== -1 && lastDotIndex < fileName.length - 1) {
                extension = fileName.substring(lastDotIndex + 1).toLowerCase();
            }
        }
        if (!extension && mimeType) {
            extension = MIME_TO_EXTENSION_MAP[mimeType] || '';
        }

        const fileInfo = {
            id: fileId || '',
            name: fileName || 'file',
            extension,
            size: fileSize || 0,
            mime_type: mimeType || '',
            has_preview_image: false,
            link: fileId ? undefined : src,
        };
        dispatch(openModal({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                startIndex: 0,
                fileInfos: [fileInfo],
            },
        }));
    }, [dispatch, fileId, fileName, fileSize, mimeType, src, loading]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        openPreviewModal();
    }, [openPreviewModal]);

    const handleDelete = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        deleteNode();
    }, [deleteNode]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPreviewModal();
        }
    }, [openPreviewModal]);

    const fileType = getFileTypeFromMime(mimeType || '');
    const iconClassName = getCompassIconClassName(fileType, true, false);

    const displayFileName = fileName || intl.formatMessage({id: 'wiki.file_attachment.unknown', defaultMessage: 'Unknown file'});
    const displaySize = fileSize ? fileSizeToString(fileSize) : '';

    const downloadAriaLabel = intl.formatMessage({id: 'wiki.file_attachment.download', defaultMessage: 'Download {filename}'}, {filename: displayFileName});
    const removeAriaLabel = intl.formatMessage({id: 'wiki.file_attachment.remove', defaultMessage: 'Remove {filename}'}, {filename: displayFileName});
    const removeTitle = intl.formatMessage({id: 'wiki.file_attachment.remove_attachment', defaultMessage: 'Remove attachment'});

    if (loading) {
        return (
            <NodeViewWrapper
                as='div'
                className='wiki-file-attachment-wrapper'
                data-file-attachment=''
            >
                <div className='wiki-file-attachment wiki-file-attachment--loading'>
                    <div className='wiki-file-attachment__icon'>
                        <i className='icon icon-loading icon-spin'/>
                    </div>
                    <div className='wiki-file-attachment__info'>
                        <span className='wiki-file-attachment__name'>{displayFileName}</span>
                        <span className='wiki-file-attachment__status'>
                            <FormattedMessage
                                id='wiki.file_attachment.uploading'
                                defaultMessage='Uploading...'
                            />
                        </span>
                    </div>
                </div>
            </NodeViewWrapper>
        );
    }

    return (
        <NodeViewWrapper
            as='div'
            className={`wiki-file-attachment-wrapper${selected ? ' wiki-file-attachment-wrapper--selected' : ''}`}
            data-file-attachment=''
            data-file-id={fileId}
        >
            <div
                className='wiki-file-attachment'
                role='button'
                tabIndex={0}
                aria-label={downloadAriaLabel}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
            >
                <div className='wiki-file-attachment__icon'>
                    <i className={`icon ${iconClassName}`}/>
                </div>
                <div className='wiki-file-attachment__info'>
                    <span
                        className='wiki-file-attachment__name'
                        title={displayFileName}
                    >
                        {displayFileName}
                    </span>
                    {displaySize && (
                        <span className='wiki-file-attachment__size'>{displaySize}</span>
                    )}
                </div>
                {isEditable && (
                    <button
                        type='button'
                        className='wiki-file-attachment__delete'
                        onClick={handleDelete}
                        aria-label={removeAriaLabel}
                        title={removeTitle}
                    >
                        <i className='icon icon-close'/>
                    </button>
                )}
            </div>
        </NodeViewWrapper>
    );
};

export default FileAttachmentNodeView;
