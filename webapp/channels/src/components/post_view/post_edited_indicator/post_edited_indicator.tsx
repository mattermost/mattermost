// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MouseEvent, KeyboardEvent} from 'react';
import {useIntl} from 'react-intl';

import {PencilOutlineIcon} from '@mattermost/compass-icons/components';

import {getDateForTimezone} from 'mattermost-redux/utils/timezone_utils';

import WithTooltip from 'components/with_tooltip';

import Constants from 'utils/constants';
import {isSameDay, isWithinLastWeek, isYesterday} from 'utils/datetime';

import type {Props} from './index';

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

    const showPostEditHistory = (e: MouseEvent<HTMLButtonElement> | KeyboardEvent<unknown>) => {
        e.preventDefault();
        if (post?.id) {
            actions.openShowEditHistory(post);
        }
    };

    const handleKeyPress = (e: KeyboardEvent<unknown>) => {
        if (e.key === Constants.KeyCodes.ENTER[0] || e.key === Constants.KeyCodes.SPACE[0]) {
            showPostEditHistory(e);
        }
    };

    const editedIndicatorContent = (
        <span
            id={`postEdited_${postId}`}
            className='post-edited__indicator'
            data-post-id={postId}
            data-edited-at={editedAt}
        >
            <PencilOutlineIcon size={12}/>
            {editedText}
        </span>
    );

    const editedIndicator = (postOwner && canEdit) ? (
        <button
            className={'style--none'}
            tabIndex={0}
            onClick={showPostEditHistory}
            onKeyUp={handleKeyPress}
            aria-label={editedText}
        >
            {editedIndicatorContent}
        </button>
    ) : editedIndicatorContent;

    return !postId || editedAt === 0 ? null : (
        <WithTooltip
            title={
                <>
                    {`${editedText} ${formattedTime}`}
                    {postOwnerTooltipInfo}
                </>
            }
        >
            {editedIndicator}
        </WithTooltip>
    );
};

export default PostEditedIndicator;
