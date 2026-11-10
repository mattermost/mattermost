// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import {ReplyOutlineIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import type {Locations} from 'utils/constants';

type Props = {
    location?: keyof typeof Locations;
    handleCommentClick?: React.EventHandler<React.MouseEvent>;
    searchStyle?: string;
    commentCount?: number;
    postId?: string;
    extraClass: string;
};

const CommentIcon = ({
    location = 'CENTER',
    searchStyle = '',
    commentCount = 0,
    extraClass = '',
    handleCommentClick,
    postId,
}: Props) => {
    const intl = useIntl();

    const replyTitle = intl.formatMessage({
        id: 'post_info.comment_icon.tooltip.reply',
        defaultMessage: 'Reply',
    });

    return (
        <WithTooltip
            title={replyTitle}
        >
            <IconButton
                id={`${location}_commentIcon_${postId}`}
                size='small'
                padding='compact'
                className={classNames(
                    'post-menu__item',
                    {
                        'post-menu__item--wide': commentCount > 0 || Boolean(searchStyle),
                        'post-menu__item--show': commentCount > 0,
                    },
                    searchStyle,
                    extraClass,
                )}
                icon={<Icon glyph={<ReplyOutlineIcon/>}/>}
                count={commentCount > 0 ? commentCount : undefined}
                aria-label={replyTitle.toLowerCase()}
                onClick={handleCommentClick}
            />
        </WithTooltip>
    );
};

export default CommentIcon;
