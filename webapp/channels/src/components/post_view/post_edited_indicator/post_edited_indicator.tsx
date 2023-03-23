// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {MouseEvent} from 'react';
import {useIntl} from 'react-intl';
import Icon from '@mattermost/compass-components/foundations/icon';

import {getDateForTimezone} from 'mattermost-redux/utils/timezone_utils';
import {isSameDay, isWithinLastWeek, isYesterday} from 'utils/datetime';

import OverlayTrigger from '../../overlay_trigger';
import Tooltip from '../../tooltip';

import {Props} from './index';

const PostEditedIndicator = ({postId, isMilitaryTime, timeZone, editedAt = 0, postOwner, post, canEdit, actions}: Props): JSX.Element | null => {
    const {formatMessage, formatDate, formatTime} = useIntl();

    if (!postId || editedAt === 0) {
        return null;
    }

    const editedDate = timeZone ? getDateForTimezone(new Date(editedAt), timeZone) : new Date(editedAt);

    let date;
    switch (true) {
    case isSameDay(editedDate):
        date = formatMessage({id: 'datetime.today', defaultMessage: 'today '});
        break;
    case isYesterday(editedDate):
        date = formatMessage({id: 'datetime.yesterday', defaultMessage: 'yesterday '});
        break;
    case isWithinLastWeek(editedDate):
        date = formatDate(editedDate, {weekday: 'long'});
        break;
    case !isWithinLastWeek(editedDate):
    default:
        date = formatDate(editedDate, {month: 'long', day: 'numeric'});
    }

    const time = formatTime(editedDate, {hour: 'numeric', minute: '2-digit', hour12: !isMilitaryTime});

    const editedText = formatMessage({
        id: 'post_message_view.edited',
        defaultMessage: 'Edited',
    });

    const formattedTime = formatMessage({
        id: 'timestamp.datetime',
        defaultMessage: '{relativeOrDate} at {time}',
    },
    {
        relativeOrDate: date,
        time,
    });
    const viewHistoryText = formatMessage({
        id: 'post_message_view.view_post_edit_history',
        defaultMessage: 'Click to view history',
    });

    const postOwnerTooltipInfo = (postOwner && canEdit) ? (
        <span className='view-history__text'>{viewHistoryText}</span>
    ) : null;

    const tooltip = (
        <Tooltip
            id={`edited-post-tooltip_${postId}`}
            className='hidden-xs'
        >
            {`${editedText} ${formattedTime}`}
            {postOwnerTooltipInfo}
        </Tooltip>
    );

    const showPostEditHistory = (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (post?.id) {
            actions.getPostEditHistory(post.id);
            actions.openShowEditHistory(post);
        }
    };

    const editedIndicatorContent = (
        <span
            id={`postEdited_${postId}`}
            className='post-edited__indicator'
            data-post-id={postId}
            data-edited-at={editedAt}
        >
            <Icon
                glyph={'pencil-outline'}
                size={10}
            />
            {editedText}
        </span>
    );

    const editedIndicator = (postOwner && canEdit) ? (
        <button
            className={'style--none'}
            tabIndex={-1}
            onClick={showPostEditHistory}
        >
            {editedIndicatorContent}
        </button>
    ) : editedIndicatorContent;

    return !postId || editedAt === 0 ? null : (
        <OverlayTrigger
            delayShow={250}
            placement='top'
            overlay={tooltip}
        >
            {editedIndicator}
        </OverlayTrigger>
    );
};

export default PostEditedIndicator;
