// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useSelector} from 'react-redux';

import type {PostPriorityMetadata} from '@mattermost/types/posts';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import PriorityLabels from 'components/advanced_create_post/priority_labels';
import FilePreview from 'components/file_preview';
import Markdown from 'components/markdown';
import ProfilePicture from 'components/profile_picture';

import {imageURLForUser, handleFormattedTextClick} from 'utils/utils';

import type {PostDraft} from 'types/store/draft';

import './panel_body.scss';

type Props = {
    channelId: string;
    displayName: string;
    fileInfos: PostDraft['fileInfos'];
    message: string;
    priority?: PostPriorityMetadata;
    status: UserStatus['status'];
    uploadsInProgress: PostDraft['uploadsInProgress'];
    userId: UserProfile['id'];
    username: UserProfile['username'];
}

const OPTIONS = {
    disableGroupHighlight: true,
    mentionHighlight: false,
};

function PanelBody({
    channelId,
    displayName,
    fileInfos,
    message,
    priority,
    status,
    uploadsInProgress,
    userId,
    username,
}: Props) {
    const currentRelativeTeamUrl = useSelector(getCurrentRelativeTeamUrl);

    const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        handleFormattedTextClick(e, currentRelativeTeamUrl);
    }, [currentRelativeTeamUrl]);

    return (

        <div className='DraftPanelBody post'>
            <div className='DraftPanelBody__left post__img'>
                <ProfilePicture
                    status={status}
                    channelId={channelId}
                    username={username}
                    userId={userId}
                    size={'md'}
                    src={imageURLForUser(userId)}
                />
            </div>
            <div
                onClick={handleClick}
                className='post__content'
            >
                <div className='DraftPanelBody__right'>
                    <div className='post__header'>
                        <strong>{displayName}</strong>
                        {priority && (
                            <PriorityLabels
                                canRemove={false}
                                padding='0 0 0 8px'
                                hasError={false}
                                persistentNotifications={priority.persistent_notifications}
                                priority={priority.priority}
                                requestedAck={priority.requested_ack}
                            />
                        )}
                    </div>
                    <div className='post__body'>
                        <Markdown
                            options={OPTIONS}
                            message={message}
                        />
                    </div>
                    {(fileInfos.length > 0 || uploadsInProgress?.length > 0) && (
                        <FilePreview
                            fileInfos={fileInfos}
                            uploadsInProgress={uploadsInProgress}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default PanelBody;
