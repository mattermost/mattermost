// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps, MouseEvent, KeyboardEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {PencilOutlineIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import Timestamp, {RelativeRanges} from 'components/timestamp';

import Constants from 'utils/constants';

import type {Props} from './index';

const EDITED_AT_RANGES = [RelativeRanges.TODAY_YESTERDAY];
const EDITED_AT_TIME_FORMAT: ComponentProps<typeof Timestamp>['useTime'] = {hour: 'numeric', minute: '2-digit'};

const PostEditedIndicator = ({postId, editedAt = 0, postOwner, post, canEdit, actions}: Props): JSX.Element | null => {
    const {formatMessage} = useIntl();

    if (!postId || editedAt === 0) {
        return null;
    }

    const editedText = formatMessage({
        id: 'post_message_view.edited',
        defaultMessage: 'Edited',
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
                    <FormattedMessage
                        id='post_message_view.edited_at'
                        defaultMessage='Edited {timestamp}'
                        values={{
                            timestamp: (
                                <Timestamp
                                    value={editedAt}
                                    useSemanticOutput={false}
                                    ranges={EDITED_AT_RANGES}
                                    day='numeric'
                                    useTime={EDITED_AT_TIME_FORMAT}
                                />
                            ),
                        }}
                    />
                    {postOwnerTooltipInfo}
                </>
            }
        >
            {editedIndicator}
        </WithTooltip>
    );
};

export default PostEditedIndicator;
