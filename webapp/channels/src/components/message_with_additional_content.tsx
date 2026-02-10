// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {Post} from '@mattermost/types/posts';

import Posts from 'mattermost-redux/constants/posts';

import PostBodyAdditionalContent from 'components/post_view/post_body_additional_content';
import PostMessageView from 'components/post_view/post_message_view';

import {isPagePost} from 'utils/page_utils';
import {getPageTitle} from 'utils/post_utils';
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
    isChannelAutotranslated: boolean;
}

export default function MessageWithAdditionalContent({
    post,
    isEmbedVisible,
    pluginPostTypes,
    isRHS,
    compactDisplay,
    isChannelAutotranslated,
}: Props) {
    const hasPlugin = post.type && pluginPostTypes && Object.hasOwn(pluginPostTypes, post.type);
    const {locale} = useIntl();

    let msg;

    if (isPagePost(post)) {
        const pageTitle = getPageTitle(post, 'Untitled Page');
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
                isChannelAutotranslated={isChannelAutotranslated}
                userLanguage={locale}
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
