// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import ReplyIcon from 'components/widgets/icons/reply_icon';

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

    const tooltip = (
        <Tooltip
            id='comment-icon-tooltip'
            className='hidden-xs'
        >
            <FormattedMessage
                id='post_info.comment_icon.tooltip.reply'
                defaultMessage='Reply'
            />
        </Tooltip>
    );

    return (
        <OverlayTrigger
            delayShow={500}
            placement='top'
            overlay={tooltip}
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
        </OverlayTrigger>
    );
};

export default CommentIcon;
