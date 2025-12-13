// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {PostTypes} from 'mattermost-redux/constants';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {usePost} from 'components/common/hooks/usePost';
import InlineCommentContext from 'components/inline_comment_context';
import Markdown from 'components/markdown';
import PostProfilePicture from 'components/post_profile_picture';
import PostTime from 'components/post_view/post_time';
import UserProfile from 'components/user_profile';
import {getPageAnchorUrl} from 'components/wiki_view/page_anchor';

import {isPageComment, getPageInlineAnchorText, getPageInlineAnchorId} from 'utils/page_utils';
import {getWikiUrl} from 'utils/url';

type Props = {
    onCommentClick?: (e: React.MouseEvent, pagePost: Post | null) => void;
    rootId: string;
    showUserHeader?: boolean;
};

function PageCommentedOn({onCommentClick, rootId, showUserHeader = false}: Props) {
    const rootPost = usePost(rootId);
    const pagePost = usePost(isPageComment(rootPost) && rootPost?.props?.page_id ? rootPost.props.page_id as string : '');
    const currentTeam = useSelector(getCurrentTeam);

    const shouldRender = isPageComment(rootPost) && pagePost;

    const anchorId = getPageInlineAnchorId(rootPost);
    const wikiId = rootPost?.props?.wiki_id as string | undefined;

    const pageUrl = useMemo(() => {
        if (!anchorId || !pagePost || !wikiId || !currentTeam?.name) {
            return undefined;
        }
        const basePageUrl = getWikiUrl(currentTeam.name, pagePost.channel_id, wikiId, pagePost.id);
        return getPageAnchorUrl(basePageUrl, anchorId);
    }, [anchorId, pagePost, wikiId, currentTeam?.name]);

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();

        const wikiId = rootPost?.props?.wiki_id as string | undefined;

        const pagePostWithWiki = pagePost && wikiId ? {
            ...pagePost,
            props: {
                ...pagePost.props,
                wiki_id: wikiId,
            },
        } : pagePost;

        if (onCommentClick && pagePostWithWiki) {
            onCommentClick(e, pagePostWithWiki);
        }
    };

    if (shouldRender) {
        const pageTitle = (pagePost.props?.title as string) || 'Untitled Page';
        const anchorText = getPageInlineAnchorText(rootPost);

        return (
            <>
                {showUserHeader && rootPost && (
                    <div
                        className='post__header'
                        style={{display: 'flex', alignItems: 'center', marginBottom: '8px'}}
                    >
                        <PostProfilePicture
                            post={rootPost}
                            userId={rootPost.user_id}
                        />
                        <div style={{marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <UserProfile
                                userId={rootPost.user_id}
                                channelId={rootPost.channel_id}
                            />
                            <PostTime
                                eventTime={rootPost.create_at}
                                postId={rootPost.id}
                            />
                        </div>
                    </div>
                )}
                <div
                    data-testid='post-link'
                    className='post__link'
                >
                    <span>
                        <FormattedMessage
                            id='threading.pageComment.context'
                            defaultMessage='Commented on the page:'
                        />
                        {' '}
                        <a
                            className='theme'
                            href='#'
                            onClick={handleClick}
                            style={{cursor: 'pointer'}}
                        >
                            {pageTitle}
                        </a>
                    </span>
                    {anchorText && (
                        <div style={{marginTop: '8px'}}>
                            <InlineCommentContext
                                anchorText={anchorText}
                                anchorId={anchorId || undefined}
                                pageUrl={pageUrl}
                                commentPostId={rootPost?.id}
                            />
                        </div>
                    )}
                    {rootPost?.message && (
                        <div style={{marginTop: '8px', fontSize: '14px', lineHeight: '20px', color: 'var(--center-channel-color)'}}>
                            <Markdown
                                message={rootPost.message}
                                options={{mentionHighlight: false}}
                            />
                        </div>
                    )}
                </div>
            </>
        );
    }

    if (rootPost?.type === PostTypes.PAGE) {
        const pageTitle = (rootPost.props?.title as string) || 'Untitled Page';
        return (
            <div
                data-testid='post-link'
                className='post__link'
            >
                <span>
                    <FormattedMessage
                        id='threading.pageComment.context'
                        defaultMessage='Commented on the page:'
                    />
                    {' '}
                    <a
                        className='theme'
                        href='#'
                        onClick={(e) => {
                            onCommentClick?.(e, rootPost);
                        }}
                        style={{cursor: 'pointer'}}
                    >
                        {pageTitle}
                    </a>
                </span>
            </div>
        );
    }

    return null;
}

export default memo(PageCommentedOn);
