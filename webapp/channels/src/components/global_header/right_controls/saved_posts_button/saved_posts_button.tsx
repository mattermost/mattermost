// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import IconButton from '@mattermost/compass-components/components/icon-button'; // eslint-disable-line no-restricted-imports

import {closeRightHandSide, showFlaggedPosts} from 'actions/views/rhs';
import {getRhsState} from 'selectors/rhs';

import WithTooltip from 'components/with_tooltip';

import {RHSStates} from 'utils/constants';

import type {GlobalState} from 'types/store';

const SavedPostsButton = (): JSX.Element | null => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const rhsState = useSelector((state: GlobalState) => getRhsState(state));

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
        </WithTooltip>
    );
};

export default SavedPostsButton;
