// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import {PostTypes} from 'mattermost-redux/constants';

import {usePost} from 'components/common/hooks/usePost';
import InlineCommentContext from 'components/inline_comment_context';
import Markdown from 'components/markdown';
import PostProfilePicture from 'components/post_profile_picture';
import PostTime from 'components/post_view/post_time';
import UserProfile from 'components/user_profile';

import {isPageComment, getPageInlineAnchorText} from 'utils/page_utils';

type Props = {
    onCommentClick?: React.EventHandler<React.MouseEvent>;
    rootId: string;
    showUserHeader?: boolean;
};

function PageCommentedOn({onCommentClick, rootId, showUserHeader = false}: Props) {
    const rootPost = usePost(rootId);
    const pagePost = usePost(isPageComment(rootPost) && rootPost?.props?.page_id ? rootPost.props.page_id as string : '');

    const shouldRender = isPageComment(rootPost) && pagePost;

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
                            onClick={onCommentClick}
                        >
                            {pageTitle}
                        </a>
                    </span>
                    {anchorText && (
                        <div style={{marginTop: '8px'}}>
                            <InlineCommentContext anchorText={anchorText}/>
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
                        onClick={onCommentClick}
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
