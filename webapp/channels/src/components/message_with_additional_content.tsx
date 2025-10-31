// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Post} from '@mattermost/types/posts';

import Posts, {PostTypes} from 'mattermost-redux/constants/posts';

import PostBodyAdditionalContent from 'components/post_view/post_body_additional_content';
import PostMessageView from 'components/post_view/post_message_view';

import {extractPlaintextFromTipTapJSON} from 'utils/tiptap_utils';

import type {PluginsState} from 'types/store/plugins';

import './message_with_additional_content.scss';

type Props = {
    id?: string;
    post: Post;
    isEmbedVisible?: boolean;
    pluginPostTypes?: PluginsState['postTypes'];
    isRHS: boolean;
    compactDisplay?: boolean;
}

export default function MessageWithAdditionalContent({post, isEmbedVisible, pluginPostTypes, isRHS, compactDisplay}: Props) {
    const hasPlugin = post.type && pluginPostTypes && Object.hasOwn(pluginPostTypes, post.type);

    let msg;

    if (post.type === PostTypes.PAGE) {
        const pageTitle = (post.props?.title as string) || 'Untitled Page';
        let plainText = '';

        try {
            plainText = extractPlaintextFromTipTapJSON(post.message);
        } catch (error) {
            plainText = '';
        }

        const excerpt = plainText.length > 200 ? plainText.slice(0, 200) + '...' : plainText;

        msg = (
            <div className='post-page-preview'>
                <div className='post-page-preview__title'>
                    <i className='icon icon-file-document-outline'/>
                    <strong>{pageTitle as string}</strong>
                </div>
                {excerpt && (
                    <div className='post-page-preview__excerpt'>
                        {excerpt}
                    </div>
                )}
            </div>
        );
    } else {
        const messageWrapper = (
            <PostMessageView
                post={post}
                isRHS={isRHS}
                compactDisplay={compactDisplay}
            />
        );

        if (post.state === Posts.POST_DELETED || hasPlugin) {
            msg = messageWrapper;
        } else {
            msg = (
                <PostBodyAdditionalContent
                    post={post}
                    isEmbedVisible={isEmbedVisible}
                >
                    {messageWrapper}
                </PostBodyAdditionalContent>
            );
        }
    }

    return msg;
}
