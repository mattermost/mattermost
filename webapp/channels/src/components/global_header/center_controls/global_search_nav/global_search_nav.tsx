// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, type JSX} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {closeRightHandSide, showMentions} from 'actions/views/rhs';
import {getExplicitSearchTeam, getMentionFilters, getRhsState} from 'selectors/rhs';

import NewSearch from 'components/new_search/new_search';

import {
    Constants,
    RHSStates,
} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import {countMentionFilters} from 'utils/mention_search';

import type {GlobalState} from 'types/store';

import './global_search_nav.css';

const GlobalSearchNav = (): JSX.Element => {
    const dispatch = useDispatch();
    const rhsState = useSelector((state: GlobalState) => getRhsState(state));
    const explicitSearchTeam = useSelector(getExplicitSearchTeam);
    const mentionFilters = useSelector(getMentionFilters);

    // The shortcut and the @ button are the same control, so they close on the same condition: the
    // unfiltered mentions view. On a filtered one the shortcut widens back out to all mentions
    // rather than closing, which would otherwise leave no way back to them from the keyboard.
    const isShowingAllMentions = rhsState === RHSStates.MENTION && countMentionFilters(mentionFilters, explicitSearchTeam) === 0;

    useEffect(() => {
        const handleShortcut = (e: KeyboardEvent) => {
            if (Keyboard.cmdOrCtrlPressed(e) && e.shiftKey) {
                if (Keyboard.isKeyPressed(e, Constants.KeyCodes.M)) {
                    e.preventDefault();
                    if (isShowingAllMentions) {
                        dispatch(closeRightHandSide());
                    } else {
                        dispatch(showMentions());
                    }
                }
            }
        };

        document.addEventListener('keydown', handleShortcut);
        return () => {
            document.removeEventListener('keydown', handleShortcut);
        };
    }, [isShowingAllMentions, dispatch]);

    return (
        <div className='GlobalSearchNav'>
            <NewSearch/>
        </div>
    );
};

export default GlobalSearchNav;
