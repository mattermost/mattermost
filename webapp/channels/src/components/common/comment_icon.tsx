// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import ReplyIcon from 'components/widgets/icons/reply_icon';
import WithTooltip from 'components/with_tooltip';

import type {Locations} from 'utils/constants';

type Props = {
    location?: keyof typeof Locations;
    handleCommentClick?: React.EventHandler<React.MouseEvent>;
    searchStyle?: string;
    commentCount?: number;
    postId?: string;
    extraClass: string;
}

const CommentIcon = ({
    location = 'CENTER',
    searchStyle = '',
    commentCount = 0,
    extraClass = '',
    handleCommentClick,
    postId,
}: Props) => {
    const intl = useIntl();

    let commentCountSpan: JSX.Element | null = null;
    let iconStyle = 'post-menu__item post-menu__item--wide';
    if (commentCount > 0) {
        iconStyle += ' post-menu__item--show';
        commentCountSpan = (
            <span className='post-menu__comment-count'>
                {commentCount}
            </span>
        );
    } else if (searchStyle !== '') {
        iconStyle = `${iconStyle} ${searchStyle}`;
    }

    return (
        <WithTooltip
            id='comment-icon-tooltip'
            placement='top'
            title={intl.formatMessage({
                id: 'post_info.comment_icon.tooltip.reply',
                defaultMessage: 'Reply',
            })}
        >
            <button
                id={`${location}_commentIcon_${postId}`}
                aria-label={intl.formatMessage({id: 'post_info.comment_icon.tooltip.reply', defaultMessage: 'Reply'}).toLowerCase()}
                className={`${iconStyle} ${extraClass}`}
                onClick={handleCommentClick}
            >
                <span className='d-flex align-items-center'>
                    <ReplyIcon className='icon icon--small'/>
                    {commentCountSpan}
                </span>
            </button>
        </WithTooltip>
    );
};

export default CommentIcon;
