// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {PostPreviewMetadata} from '@mattermost/types/posts';
import type {PropertyValue} from '@mattermost/types/properties';

import {useTeam} from 'components/common/hooks/use_team';
import {useChannel} from 'components/common/hooks/useChannel';
import {usePost} from 'components/common/hooks/usePost';
import PostMessagePreview from 'components/post_view/post_message_preview';

const noop = () => {};

type Props = {
    value: PropertyValue<unknown>;
}

export default function PostPreviewPropertyRenderer({value}: Props) {
    const post = usePost(value.value as string);
    const channel = useChannel(post?.channel_id || '');
    const team = useTeam(channel?.team_id || '');

    const {formatMessage} = useIntl();

    if (!post || !channel || !team) {
        return null;
    }

    const previewMetaData: PostPreviewMetadata = {
        post,
        post_id: post.id,
        team_name: team?.name || '',
        channel_display_name: channel?.display_name || '',
        channel_type: channel?.type || 'O',
        channel_id: post.channel_id,
    };

    const postPreviewFooterMessage = formatMessage({
        id: 'forward_post_modal.preview.footer_message',
        defaultMessage: 'Originally posted in ~{channel}',
    },
    {
        channel: channel?.display_name || '',
    });

    return (
        <div
            className='PostPreviewPropertyRenderer'
            data-testid='post-preview-property'
        >
            <PostMessagePreview
                metadata={previewMetaData}
                handleFileDropdownOpened={noop}
                preventClickAction={true}
                previewFooterMessage={postPreviewFooterMessage}
            />
        </div>
    );
}
