// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';
import type {Page} from '@mattermost/types/wikis';

import {PostTypes} from 'mattermost-redux/constants';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {usePost} from 'components/common/hooks/usePost';
import InlineCommentContext from 'components/inline_comment_context';
import Markdown from 'components/markdown';
import PostProfilePicture from 'components/post_profile_picture';
import PostTime from 'components/post_view/post_time';
import UserProfile from 'components/user_profile';
import {getPageAnchorUrl} from 'components/wiki_view/page_anchor';

import {usePageForComment} from 'hooks/usePageForComment';
import {isPageComment, getPageInlineAnchorText, getPageInlineAnchorId, getPageTitle} from 'utils/page_utils';
import {getWikiUrl} from 'utils/url';

import './page_commented_on.scss';

type Props = {
    onCommentClick?: (e: React.MouseEvent, pagePost: Page | Post | null) => void;
    rootId: string;
    showUserHeader?: boolean;
};

function PageCommentedOn({onCommentClick, rootId, showUserHeader = false}: Props) {
    const rootPost = usePost(rootId);
    const {page: pagePost, status: pageStatus} = usePageForComment(rootPost);
    const currentTeam = useSelector(getCurrentTeam);

    const shouldRender = isPageComment(rootPost) && pagePost;

    const anchorId = getPageInlineAnchorId(rootPost);
    const wikiId = rootPost?.props?.wiki_id as string | undefined;

    const pageUrl = useMemo(() => {
        if (!anchorId || !pagePost || !wikiId || !currentTeam?.name) {
            return undefined;
        }
        const basePageUrl = getWikiUrl(currentTeam.name, wikiId, pagePost.id);
        return getPageAnchorUrl(basePageUrl, anchorId);
    }, [anchorId, pagePost, wikiId, currentTeam?.name]);

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();

        if (onCommentClick) {
            onCommentClick(e, pagePost);
        }
    };

    if (isPageComment(rootPost) && !pagePost) {
        // Page fetch resolved with a 404 — render the deleted-page fallback.
        if (pageStatus === 'missing') {
            return (
                <div className='PageCommentedOn'>
                    <div
                        data-testid='post-link'
                        className='post__link'
                    >
                        <span>
                            <FormattedMessage
                                id='threading.pageComment.deletedPage'
                                defaultMessage='Commented on a deleted page'
                            />
                        </span>
                    </div>
                </div>
            );
        }

        // Page fetch in flight — render a deterministic page-aware placeholder (A14)
        // instead of `null`. Returning null hands the slot back to the parent post
        // renderer, which then fills it with the generic "commented on someone's
        // message loading" text and produces the A14 anomaly in the channel feed.
        return (
            <div
                className='PageCommentedOn PageCommentedOn--loading'
                data-testid='page-commented-on-loading'
            >
                <div
                    data-testid='post-link'
                    className='post__link'
                >
                    <span>
                        <FormattedMessage
                            id='threading.pageComment.loading'
                            defaultMessage='Commented on a page'
                        />
                    </span>
                </div>
            </div>
        );
    }

    if (shouldRender) {
        const pageTitle = getPageTitle(pagePost, 'Untitled Page');
        const anchorText = getPageInlineAnchorText(rootPost);

        return (
            <div className='PageCommentedOn'>
                {showUserHeader && rootPost && (
                    <div className='post__header PageCommentedOn__header'>
                        <PostProfilePicture
                            post={rootPost}
                            userId={rootPost.user_id}
                        />
                        <div className='PageCommentedOn__userInfo'>
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
                            className='theme PageCommentedOn__pageLink'
                            href='#'
                            onClick={handleClick}
                        >
                            {pageTitle}
                        </a>
                    </span>
                    {anchorText && (
                        <div className='PageCommentedOn__anchorContext'>
                            <InlineCommentContext
                                anchorText={anchorText}
                                anchorId={anchorId || undefined}
                                pageUrl={pageUrl}
                                commentPostId={rootPost?.id}
                            />
                        </div>
                    )}
                    {rootPost?.message && (
                        <div className='PageCommentedOn__message'>
                            <Markdown
                                message={rootPost.message}
                                options={{mentionHighlight: false}}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (rootPost?.type === PostTypes.PAGE) {
        const pageTitle = getPageTitle(rootPost, 'Untitled Page');
        return (
            <div className='PageCommentedOn'>
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
                            className='theme PageCommentedOn__pageLink'
                            href='#'
                            onClick={(e) => {
                                onCommentClick?.(e, rootPost);
                            }}
                        >
                            {pageTitle}
                        </a>
                    </span>
                </div>
            </div>
        );
    }

    return null;
}

export default memo(PageCommentedOn);
