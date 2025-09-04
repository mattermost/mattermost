// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import type {Post, PostPreviewMetadata} from '@mattermost/types/posts';
import type {PropertyValue} from '@mattermost/types/properties';

import {useTeam} from 'components/common/hooks/use_team';
import {useChannel} from 'components/common/hooks/useChannel';
import {usePost} from 'components/common/hooks/usePost';
import PostMessagePreview from 'components/post_view/post_message_preview';
import type {PostPreviewFieldMetadata} from 'components/properties_card_view/properties_card_view';

const noop = () => {};

type Props = {
    value: PropertyValue<unknown>;
    metadata?: PostPreviewFieldMetadata;
}

export default function PostPreviewPropertyRenderer({value, metadata}: Props) {
    const postId = value.value as string;

    const [post, setPost] = useState<Post>();
    const channel = useChannel(post?.channel_id || '');
    const team = useTeam(channel?.team_id || '');

    const loaded = useRef(false);

    const postFromStore = usePost(postId);

    useEffect(() => {
        if ((!metadata || !metadata.getPost) && postFromStore) {
            if (postFromStore.delete_at !== 0 && !metadata?.fetchDeletedPost) {
                setPost(postFromStore);
                loaded.current = true;
                return;
            }
        }

        const loadPost = async () => {
            if (!metadata || loaded.current || Boolean(post)) {
                return;
            }

            try {
                const fetchedPost = await metadata.getPost!(postId);
                if (fetchedPost) {
                    setPost(fetchedPost);
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.log(error);
            } finally {
                loaded.current = true;
            }
        };

        loadPost();
    }, [metadata, post, postFromStore, postId]);

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
