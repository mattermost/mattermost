// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useSelector} from 'react-redux';
import {FormattedMessage} from 'react-intl';

import {CheckCircleOutlineIcon} from '@mattermost/compass-icons/components';

import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import Markdown from 'components/markdown';
import FilePreview from 'components/file_preview';
import ProfilePicture from 'components/profile_picture';
import PriorityLabel from 'components/post_priority/post_priority_label';
import {imageURLForUser, handleFormattedTextClick} from 'utils/utils';

import type {PostDraft} from 'types/store/draft';

import type {UserProfile, UserStatus} from '@mattermost/types/users';
import {PostPriorityMetadata} from '@mattermost/types/posts';

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
                            <div className='DraftPanelBody__priority'>
                                {priority.priority && (
                                    <PriorityLabel
                                        size='xs'
                                        priority={priority.priority}
                                    />
                                )}
                                {priority.requested_ack && (
                                    <div className='DraftPanelBody__priority-ack'>
                                        <CheckCircleOutlineIcon size={14}/>
                                        {!priority.priority && (
                                            <FormattedMessage
                                                id={'post_priority.request_acknowledgement'}
                                                defaultMessage={'Request acknowledgement'}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
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
