// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {closeRightHandSide, showFlaggedPosts} from 'actions/views/rhs';
import {getRhsState} from 'selectors/rhs';

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
                style='inverted'
                size='small'
                padding='compact'
                icon={<i className='icon icon-bookmark-outline' aria-hidden='true'/>}
                toggled={rhsState === RHSStates.FLAG}
                onClick={savedPostsButtonClick}
                aria-expanded={rhsState === RHSStates.FLAG}
                aria-controls='searchContainer'
                aria-label={formatMessage({id: 'channel_header.flagged', defaultMessage: 'Saved messages'})}
            />
        </WithTooltip>
    );
};

export default SavedPostsButton;
