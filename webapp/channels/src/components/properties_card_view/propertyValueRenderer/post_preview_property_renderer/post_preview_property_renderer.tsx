// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {PostPreviewMetadata} from '@mattermost/types/posts';
import type {PropertyValue} from '@mattermost/types/properties';

import {usePropertyCardViewChannelLoader} from 'components/common/hooks/usePropertyCardViewChannelLoader';
import {usePropertyCardViewPostLoader} from 'components/common/hooks/usePropertyCardViewPostLoader';
import {usePropertyCardViewTeamLoader} from 'components/common/hooks/usePropertyCardViewTeamLoader';
import PostMessagePreview from 'components/post_view/post_message_preview';
import type {PostPreviewFieldMetadata} from 'components/properties_card_view/properties_card_view';

const noop = () => {};

type Props = {
    value: PropertyValue<unknown>;
    metadata?: PostPreviewFieldMetadata;
}

export default function PostPreviewPropertyRenderer({value, metadata}: Props) {
    const postId = value.value as string;

    const post = usePropertyCardViewPostLoader(postId, metadata?.getPost, true);
    const channel = usePropertyCardViewChannelLoader(post?.channel_id, metadata?.getChannel);
    const team = usePropertyCardViewTeamLoader(channel?.team_id, metadata?.getTeam);

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
                usePostAsSource={true}
            />
        </div>
    );
}
