// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {Posts, PostTypes} from 'mattermost-redux/constants';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import InlineCommentContext from 'components/inline_comment_context';
import Markdown from 'components/markdown';

import type {GlobalState} from 'types/store';

type MarkdownPreviewOptions = {
    singleline: boolean;
    mentionHighlight: boolean;
    atMentions: boolean;
};

type ImageProps = {
    onImageHeightChanged: () => void;
    onImageLoaded: () => void;
};

export function renderPageCommentPreview(
    post: Post,
    pagePost: Post,
    msgDeleted: string,
    markdownPreviewOptions: MarkdownPreviewOptions,
    mentionsKeys: Array<{key: string}>,
    imageProps: ImageProps,
    onPageLinkClick?: (e: React.MouseEvent) => void,
): JSX.Element {
    const anchorText = post.props?.inline_anchor ? (post.props.inline_anchor as {text: string}).text : null;

    return (
        <>
            <div
                style={{
                    fontSize: '12px',
                    color: 'rgba(var(--center-channel-color-rgb), 0.64)',
                    marginBottom: '2px',
                }}
            >
                <FormattedMessage
                    id='threading.pageComment.context'
                    defaultMessage='Commented on the page:'
                />
                {' '}
                <a
                    onClick={onPageLinkClick}
                    style={{
                        fontWeight: 600,
                        color: 'var(--link-color)',
                        cursor: 'pointer',
                        textDecoration: 'none',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.textDecoration = 'none';
                    }}
                >
                    {(pagePost.props?.title as string) || 'Untitled Page'}
                </a>
            </div>
            {anchorText && (
                <InlineCommentContext anchorText={anchorText}/>
            )}
            {post.message && (
                <div style={{marginTop: '4px'}}>
                    <Markdown
                        message={post.state === Posts.POST_DELETED ? msgDeleted : post.message}
                        options={markdownPreviewOptions}
                        imagesMetadata={post?.metadata && post?.metadata?.images}
                        mentionKeys={mentionsKeys}
                        imageProps={imageProps}
                    />
                </div>
            )}
        </>
    );
}

export function renderPagePreview(post: Post, hasReplies: boolean): JSX.Element {
    if (hasReplies) {
        return (
            <InlineCommentContext anchorText={(post.props?.title as string) || 'Untitled Page'}/>
        );
    }

    return (
        <div>
            <i className='icon icon-file-document-outline'/>
            {' '}
            {(post.props?.title as string) || 'Untitled Page'}
        </div>
    );
}

export function usePagePostForComment(post: Post | null): Post | null {
    return useSelector((state: GlobalState) => {
        if (!post || post.type !== PostTypes.PAGE_COMMENT || !post.props?.page_id) {
            return null;
        }
        return getPost(state, post.props.page_id as string);
    });
}
