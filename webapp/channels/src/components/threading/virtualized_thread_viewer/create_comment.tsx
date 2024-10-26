// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, forwardRef, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {ArchiveOutlineIcon} from '@mattermost/compass-icons/components';
import type {UserProfile} from '@mattermost/types/users';

import {makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getPost, getLimitedViews} from 'mattermost-redux/selectors/entities/posts';

import AdvancedCreateComment from 'components/advanced_create_comment';
import BasicSeparator from 'components/widgets/separator/basic-separator';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

type Props = {
    teammate?: UserProfile;
    threadId: string;
    isThreadView?: boolean;
    placeholder?: string;
};

const CreateComment = forwardRef<HTMLDivElement, Props>(({
    teammate,
    threadId,
    isThreadView,
    placeholder,
}: Props, ref) => {
    const getChannel = useMemo(makeGetChannel, []);
    const rootPost = useSelector((state: GlobalState) => getPost(state, threadId));
    const threadIsLimited = useSelector(getLimitedViews).threads[threadId];
    const channel = useSelector((state: GlobalState) => {
        if (threadIsLimited) {
            return null;
        }
        return getChannel(state, rootPost.channel_id);
    });
    if (!channel || threadIsLimited) {
        return null;
    }
    const isFakeDeletedPost = rootPost.type === Constants.PostTypes.FAKE_PARENT_DELETED;

    const channelType = channel.type;
    const channelIsArchived = channel.delete_at !== 0;

    if (channelType === Constants.DM_CHANNEL && teammate?.delete_at) {
        return (
            <div
                className='post-create-message'
            >
                <FormattedMessage
                    id='createComment.threadFromDeactivatedUserMessage'
                    defaultMessage='You are viewing an archived channel with a <strong>deactivated user</strong>. New messages cannot be posted.'
                    values={{
                        strong: (chunks: string) => <strong>{chunks}</strong>,
                    }}
                />
            </div>
        );
    }

    if (isFakeDeletedPost) {
        return null;
    }

    if (channelIsArchived) {
        return (
            <div className='channel-archived-warning__container'>
                <BasicSeparator/>
                <div className='channel-archived-warning__content'>
                    <ArchiveOutlineIcon
                        size={20}
                        color={'rgba(var(--center-channel-color-rgb), 0.75)'}
                    />
                    <FormattedMessage
                        id='createComment.threadFromArchivedChannelMessage'
                        defaultMessage='You are viewing a thread from an <strong>archived channel</strong>. New messages cannot be posted.'
                        values={{
                            strong: (chunks: string) => <strong>{chunks}</strong>,
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div
            className='post-create__container'
            ref={ref}
            data-testid='comment-create'
        >
            <AdvancedCreateComment
                placeholder={placeholder}
                channelId={channel.id}
                rootId={threadId}
                isThreadView={isThreadView}
            />
        </div>
    );
});

export default memo(CreateComment);
