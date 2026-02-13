// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import type {FileSearchResultItem} from '@mattermost/types/files';

import {searchFilesWithParams} from 'mattermost-redux/actions/search';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getUsers} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';

import {isFileAttachmentsEnabled} from 'utils/file_utils';

import ChannelFilesTable from './channel_files_table';

interface Props {
    channelId: string;
}

function ChannelFilesContent({channelId}: Props) {
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);
    const config = useSelector(getConfig);
    const teamId = useSelector(getCurrentTeamId);
    const users = useSelector(getUsers);
    const [isLoading, setIsLoading] = useState(true);
    const [fileResults, setFileResults] = useState<Record<string, FileSearchResultItem>>({});

    // Check if file attachments are enabled
    const fileAttachmentsEnabled = isFileAttachmentsEnabled(config);

    useEffect(() => {
        // Fetch channel files directly without opening sidebar
        if (channelId && fileAttachmentsEnabled && teamId) {
            const fetchChannelFiles = async () => {
                try {
                    setIsLoading(true);

                    // Perform search for files in this channel
                    const searchParams = {
                        terms: `channel:${channelId}`,
                        is_or_search: false,
                        include_deleted_channels: false,
                        page: 0,
                        per_page: 50,
                    };
                    const results = await dispatch(searchFilesWithParams(teamId, searchParams));
                    if (results && results.data && typeof results.data === 'object' && results.data !== null && 'file_infos' in results.data) {
                        setFileResults(results.data.file_infos as Record<string, FileSearchResultItem>);
                    }
                } catch (error) {
                    // Failed to fetch channel files - reset to empty state
                    setFileResults({});
                } finally {
                    setIsLoading(false);
                }
            };

            fetchChannelFiles();
        }
    }, [channelId, dispatch, fileAttachmentsEnabled, teamId]);

    if (!fileAttachmentsEnabled) {
        return (
            <div className='channel-tab-panel-content__placeholder'>
                <h3>{'Files'}</h3>
                <p>{'File attachments are not enabled for this server.'}</p>
            </div>
        );
    }

    if (!channel || channel.id !== channelId) {
        return (
            <div className='channel-tab-panel-content__placeholder'>
                <h3>{'Files'}</h3>
                <p>{'Loading files...'}</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className='channel-tab-panel-content__placeholder'>
                <h3>{'Files'}</h3>
                <p>{'Loading files...'}</p>
            </div>
        );
    }

    const fileResultsArray = Object.values(fileResults);
    if (fileResultsArray.length === 0) {
        return (
            <div className='channel-tab-panel-content__placeholder'>
                <h3>{'Files'}</h3>
                <p>{'No files found in this channel.'}</p>
            </div>
        );
    }

    // Transform file results to match table format
    const tableFiles = fileResultsArray.map((file: FileSearchResultItem) => {
        // Find the user who uploaded this file
        const user = users[file.user_id];

        return {
            id: file.id,
            name: file.name,
            extension: file.extension,
            size: file.size,
            create_at: file.create_at,
            user_id: file.user_id,
            user_name: user?.username || user?.first_name || 'Unknown User',
            user_avatar: user?.last_picture_update ? `/api/v4/users/${file.user_id}/image` : undefined,
        };
    });

    return (
        <div className='channel-files-content'>
            <div className='channel-files-content__header'>
                <h3 className='channel-files-content__title'>{'Files'}</h3>
            </div>
            <div className='channel-files-content__table'>
                <ChannelFilesTable
                    files={tableFiles}
                    isLoading={isLoading}
                    actions={{
                        openModal: (modalData: unknown) => dispatch(openModal(modalData as Parameters<typeof openModal>[0])),
                    }}
                />
            </div>
        </div>
    );
}

export default ChannelFilesContent;
