// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {AtIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {closeRightHandSide, showMentions} from 'actions/views/rhs';
import {getExplicitSearchTeam, getMentionFilters, getRhsState} from 'selectors/rhs';

import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';

import {RHSStates} from 'utils/constants';
import {countMentionFilters} from 'utils/mention_search';

import type {GlobalState} from 'types/store';

const AtMentionsButton = (): JSX.Element => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const rhsState = useSelector((state: GlobalState) => getRhsState(state));
    const explicitSearchTeam = useSelector(getExplicitSearchTeam);
    const mentionFilters = useSelector(getMentionFilters);

    // A filtered mention search also sits in the MENTION state, so closing on any MENTION state
    // would turn this button into a dead end for getting back to all mentions. Close only when the
    // unfiltered view this button opens is already the one showing.
    const isShowingAllMentions = rhsState === RHSStates.MENTION && countMentionFilters(mentionFilters, explicitSearchTeam) === 0;

    const mentionButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (isShowingAllMentions) {
            dispatch(closeRightHandSide());
        } else {
            dispatch(showMentions());
        }
    };

    return (
        <WithTooltip
            title={
                <>
                    <FormattedMessage
                        id='channel_header.recentMentions'
                        defaultMessage='Recent mentions'
                    />
                    <KeyboardShortcutSequence
                        shortcut={KEYBOARD_SHORTCUTS.navMentions}
                        hideDescription={true}
                        isInsideTooltip={true}
                    />
                </>
            }
            forcedPlacement='bottom'
        >
            <IconButton
                style='inverted'
                size='small'
                padding='compact'
                icon={<Icon glyph={<AtIcon/>}/>}
                toggled={rhsState === RHSStates.MENTION}
                onClick={mentionButtonClick}
                aria-expanded={rhsState === RHSStates.MENTION}
                aria-controls='searchContainer'
                aria-label={formatMessage({id: 'channel_header.recentMentions', defaultMessage: 'Recent mentions'})}
            />
        </WithTooltip>
    );
};

export default AtMentionsButton;
