// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import FilePreviewModal from 'components/file_preview_modal';

import {ModalIdentifiers} from 'utils/constants';
import {getFileType, getCompassIconClassName} from 'utils/utils';

import './channel_files_table.scss';

interface FileData {
    id: string;
    name: string;
    extension: string;
    size: number;
    create_at: number;
    user_id: string;
    user_name?: string;
    user_avatar?: string;
}

interface Props {
    files: FileData[];
    isLoading: boolean;
    actions: {
        openModal: (modalData: unknown) => void;
    };
}

type SortColumn = 'name' | 'user' | 'date' | 'size';
type SortDirection = 'asc' | 'desc';

function ChannelFilesTable({files, isLoading, actions}: Props) {
    const [sortColumn, setSortColumn] = useState<SortColumn>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const handleHeaderClick = (column: SortColumn) => {
        if (sortColumn === column) {
            // Toggle direction if same column
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // Set new column with default direction
            setSortColumn(column);
            setSortDirection(column === 'date' ? 'desc' : 'asc'); // Default newest first for date
        }
    };

    const sortedFiles = useMemo(() => {
        if (!files.length) {
            return files;
        }

        const sorted = [...files].sort((a, b) => {
            let comparison = 0;

            switch (sortColumn) {
            case 'name':
                comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
                break;
            case 'user':
                comparison = (a.user_name || '').toLowerCase().localeCompare((b.user_name || '').toLowerCase());
                break;
            case 'date':
                comparison = a.create_at - b.create_at;
                break;
            case 'size':
                comparison = a.size - b.size;
                break;
            default:
                return 0;
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });

        return sorted;
    }, [files, sortColumn, sortDirection]);

    const renderSortIcon = (column: SortColumn) => {
        if (sortColumn !== column) {
            return <i className='icon icon-unfold-more-horizontal channel-files-table__sort-icon'/>;
        }
        return (
            <i
                className={`icon ${sortDirection === 'asc' ? 'icon-arrow-up' : 'icon-arrow-down'} channel-files-table__sort-icon channel-files-table__sort-icon--active`}
            />
        );
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) {
            return '0 B';
        }
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    };

    const formatDate = (timestamp: number): string => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const handleFileClick = (file: FileData) => {
        actions.openModal({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                fileInfos: [{
                    id: file.id,
                    name: file.name,
                    extension: file.extension,
                    size: file.size,
                    create_at: file.create_at,
                    user_id: file.user_id,
                }],
                startIndex: 0,
            },
        });
    };

    if (isLoading) {
        return (
            <div className='channel-files-table'>
                <div className='channel-files-table__loading'>
                    <FormattedMessage
                        id='channel_tabs.files.loading'
                        defaultMessage='Loading files...'
                    />
                </div>
            </div>
        );
    }

    if (files.length === 0) {
        return (
            <div className='channel-files-table'>
                <div className='channel-files-table__empty'>
                    <FormattedMessage
                        id='channel_tabs.files.empty'
                        defaultMessage='No files found in this channel.'
                    />
                </div>
            </div>
        );
    }

    return (
        <div className='channel-files-table'>
            <div className='channel-files-table__header'>
                <div
                    className='channel-files-table__header-cell channel-files-table__header-cell--name channel-files-table__header-cell--clickable'
                    onClick={() => handleHeaderClick('name')}
                    role='button'
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleHeaderClick('name');
                        }
                    }}
                >
                    <span className='channel-files-table__header-text'>
                        <FormattedMessage
                            id='channel_tabs.files.table.name'
                            defaultMessage='Name'
                        />
                    </span>
                    {renderSortIcon('name')}
                </div>
                <div
                    className='channel-files-table__header-cell channel-files-table__header-cell--user channel-files-table__header-cell--clickable'
                    onClick={() => handleHeaderClick('user')}
                    role='button'
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleHeaderClick('user');
                        }
                    }}
                >
                    <span className='channel-files-table__header-text'>
                        <FormattedMessage
                            id='channel_tabs.files.table.sent_by'
                            defaultMessage='Sent by'
                        />
                    </span>
                    {renderSortIcon('user')}
                </div>
                <div
                    className='channel-files-table__header-cell channel-files-table__header-cell--date channel-files-table__header-cell--clickable'
                    onClick={() => handleHeaderClick('date')}
                    role='button'
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleHeaderClick('date');
                        }
                    }}
                >
                    <span className='channel-files-table__header-text'>
                        <FormattedMessage
                            id='channel_tabs.files.table.date_sent'
                            defaultMessage='Date sent'
                        />
                    </span>
                    {renderSortIcon('date')}
                </div>
                <div
                    className='channel-files-table__header-cell channel-files-table__header-cell--size channel-files-table__header-cell--clickable'
                    onClick={() => handleHeaderClick('size')}
                    role='button'
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleHeaderClick('size');
                        }
                    }}
                >
                    <span className='channel-files-table__header-text'>
                        <FormattedMessage
                            id='channel_tabs.files.table.file_size'
                            defaultMessage='File size'
                        />
                    </span>
                    {renderSortIcon('size')}
                </div>
            </div>
            <div className='channel-files-table__body'>
                {sortedFiles.map((file) => (
                    <div
                        key={file.id}
                        className='channel-files-table__row'
                    >
                        <div className='channel-files-table__cell channel-files-table__cell--name'>
                            <div
                                className='channel-files-table__file-info channel-files-table__file-info--clickable'
                                onClick={() => handleFileClick(file)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleFileClick(file);
                                    }
                                }}
                                role='button'
                                tabIndex={0}
                            >
                                <i
                                    className={`icon ${getCompassIconClassName(getFileType(file.extension))} channel-files-table__file-icon`}
                                />
                                <span className='channel-files-table__file-name'>{file.name}</span>
                            </div>
                        </div>
                        <div className='channel-files-table__cell channel-files-table__cell--user'>
                            <div className='channel-files-table__user-info'>
                                <div className='channel-files-table__user-avatar'>
                                    {file.user_avatar ? (
                                        <img
                                            src={file.user_avatar}
                                            alt={file.user_name || 'User'}
                                        />
                                    ) : (
                                        <div className='channel-files-table__user-avatar-placeholder'>
                                            {(file.user_name || 'U').charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <span className='channel-files-table__user-name'>{file.user_name || 'Unknown User'}</span>
                            </div>
                        </div>
                        <div className='channel-files-table__cell channel-files-table__cell--date'>
                            <span className='channel-files-table__date'>{formatDate(file.create_at)}</span>
                        </div>
                        <div className='channel-files-table__cell channel-files-table__cell--size'>
                            <span className='channel-files-table__size'>{formatFileSize(file.size)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ChannelFilesTable;
