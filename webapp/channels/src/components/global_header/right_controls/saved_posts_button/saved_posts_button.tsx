// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import IconButton from '@mattermost/compass-components/components/icon-button'; // eslint-disable-line no-restricted-imports

import {countFlaggedPosts} from 'mattermost-redux/actions/search';
import {getFlaggedPostsCount} from 'mattermost-redux/selectors/entities/posts';

import {closeRightHandSide, showFlaggedPosts} from 'actions/views/rhs';
import {getRhsState} from 'selectors/rhs';

import WithTooltip from 'components/with_tooltip';

import {RHSStates} from 'utils/constants';

import type {GlobalState} from 'types/store';

const SavedPostsButtonContainer = styled.div`
    position: relative;

    .savedPostButton--count {
        display: flex;
        position: absolute;
        bottom: 0;
        right: 0;
        width: 16px;
        height: 16px;
        align-items: center;
        justify-content: center;
        background-color: var(--button-bg);
        color: var(--button-color);
        border-radius: 50%;
        font-size: 9px;
        pointer-events: none;
    }
`;

const SavedPostsButton = (): JSX.Element | null => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const rhsState = useSelector((state: GlobalState) => getRhsState(state));
    const flaggedCount = useSelector((state: GlobalState) => getFlaggedPostsCount(state));

    useEffect(() => {
        if (!flaggedCount) {
            dispatch(countFlaggedPosts());
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const savedPostsButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (rhsState === RHSStates.FLAG) {
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
        >
            <SavedPostsButtonContainer>
                <IconButton
                    size={'sm'}
                    icon={'bookmark-outline'}
                    toggled={rhsState === RHSStates.FLAG}
                    onClick={savedPostsButtonClick}
                    inverted={true}
                    compact={true}
                    aria-expanded={rhsState === RHSStates.FLAG}
                    aria-controls='searchContainer' // Must be changed if the ID of the container changes
                    aria-label={formatMessage({id: 'channel_header.flagged', defaultMessage: 'Saved messages'})}
                />
                {
                    flaggedCount > 0 && (
                        <span className='savedPostButton--count'>{flaggedCount}</span>
                    )
                }
            </SavedPostsButtonContainer>
        </WithTooltip>
    );
};

export default SavedPostsButton;
