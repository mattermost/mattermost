// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import classNames from 'classnames';

import AtIcon from '@mattermost/compass-icons/components/at';

import {closeRightHandSide, showMentions} from 'actions/views/rhs';
import {getRhsState} from 'selectors/rhs';

import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import WithTooltip from 'components/with_tooltip';

import {RHSStates} from 'utils/constants';

import type {GlobalState} from 'types/store';

/**
 * MentionsButton renders an @ icon that toggles the mentions RHS panel.
 * - Shows active state (blue bar) when mentions panel is open
 * - Toggles between showMentions and closeRightHandSide actions
 * - Tooltip includes keyboard shortcut for quick access
 */
export const MentionsButton = (): JSX.Element => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const rhsState = useSelector((state: GlobalState) => getRhsState(state));

    const isActive = rhsState === RHSStates.MENTION;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (isActive) {
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
            isVertical={false}
        >
            <button
                type="button"
                className={classNames('UtilityButton', {
                    'UtilityButton--active': isActive,
                })}
                onClick={handleClick}
                aria-expanded={isActive}
                aria-controls='searchContainer'
                aria-label={formatMessage({id: 'channel_header.recentMentions', defaultMessage: 'Recent mentions'})}
            >
                <AtIcon
                    size={20}
                    color={isActive ? 'var(--sidebar-text)' : 'rgba(var(--sidebar-text-rgb), 0.64)'}
                />
            </button>
        </WithTooltip>
    );
};

export default MentionsButton;
