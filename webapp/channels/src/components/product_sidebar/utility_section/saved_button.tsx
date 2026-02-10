// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import BookmarkOutlineIcon from '@mattermost/compass-icons/components/bookmark-outline';

import {closeRightHandSide, showFlaggedPosts} from 'actions/views/rhs';
import {getRhsState} from 'selectors/rhs';

import WithTooltip from 'components/with_tooltip';

import {RHSStates} from 'utils/constants';

import type {GlobalState} from 'types/store';

/**
 * SavedButton renders a bookmark icon that toggles the saved posts RHS panel.
 * - Shows active state (blue bar) when saved posts panel is open
 * - Toggles between showFlaggedPosts and closeRightHandSide actions
 */
export const SavedButton = (): JSX.Element => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const rhsState = useSelector((state: GlobalState) => getRhsState(state));

    const isActive = rhsState === RHSStates.FLAG;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (isActive) {
            dispatch(closeRightHandSide());
        } else {
            dispatch(showFlaggedPosts());
        }
    };

    return (
        <WithTooltip
            title={
                <FormattedMessage
                    id='channel_header.flagged'
                    defaultMessage='Saved messages'
                />
            }
            isVertical={false}
        >
            <button
                type='button'
                className={classNames('UtilityButton', {
                    'UtilityButton--active': isActive,
                })}
                onClick={handleClick}
                aria-expanded={isActive}
                aria-controls='searchContainer'
                aria-label={formatMessage({id: 'channel_header.flagged', defaultMessage: 'Saved messages'})}
            >
                <BookmarkOutlineIcon
                    size={20}
                    color={isActive ? 'var(--sidebar-text)' : 'rgba(var(--sidebar-text-rgb), 0.64)'}
                />
            </button>
        </WithTooltip>
    );
};

export default SavedButton;
