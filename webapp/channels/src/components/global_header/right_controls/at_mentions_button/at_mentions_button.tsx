// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import IconButton from '@mattermost/compass-components/components/icon-button'; // eslint-disable-line no-restricted-imports

import {closeRightHandSide, showMentions} from 'actions/views/rhs';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import {getRhsState} from 'selectors/rhs';
import {GlobalState} from 'types/store';
import Constants, {RHSStates} from 'utils/constants';
import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';

const AtMentionsButton = (): JSX.Element => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const rhsState = useSelector((state: GlobalState) => getRhsState(state));

    const mentionButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (rhsState === RHSStates.MENTION) {
            dispatch(closeRightHandSide());
        } else {
            dispatch(showMentions());
        }
    };

    const tooltip = (
        <Tooltip id='recentMentions'>
            <FormattedMessage
                id='channel_header.recentMentions'
                defaultMessage='Recent mentions'
            />
            <KeyboardShortcutSequence
                shortcut={KEYBOARD_SHORTCUTS.navMentions}
                hideDescription={true}
                isInsideTooltip={true}
            />
        </Tooltip>
    );

    return (
        <OverlayTrigger
            trigger={['hover', 'focus']}
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement='bottom'
            overlay={tooltip}
        >
            <IconButton
                size={'sm'}
                icon={'at'}
                toggled={rhsState === RHSStates.MENTION}
                onClick={mentionButtonClick}
                inverted={true}
                compact={true}
                aria-expanded={rhsState === RHSStates.MENTION}
                aria-controls='searchContainer' // Must be changed if the ID of the container changes
                aria-label={formatMessage({id: 'channel_header.recentMentions', defaultMessage: 'Recent mentions'})}
            />
        </OverlayTrigger>
    );
};

export default AtMentionsButton;
