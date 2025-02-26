// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import Flex from '@mattermost/compass-components/utilities/layout/Flex'; // eslint-disable-line no-restricted-imports

import {closeRightHandSide, showMentions} from 'actions/views/rhs';
import {getRhsState} from 'selectors/rhs';

import NewSearch from 'components/new_search/new_search';

import {
    Constants,
    RHSStates,
} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

import type {GlobalState} from 'types/store';

const GlobalSearchNav = (): JSX.Element => {
    const dispatch = useDispatch();
    const rhsState = useSelector((state: GlobalState) => getRhsState(state));

    useEffect(() => {
        const handleShortcut = (e: KeyboardEvent) => {
            if (Keyboard.cmdOrCtrlPressed(e) && e.shiftKey) {
                if (Keyboard.isKeyPressed(e, Constants.KeyCodes.M)) {
                    e.preventDefault();
                    if (rhsState === RHSStates.MENTION) {
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
    }, [rhsState, dispatch]);

    return (
        <Flex
            row={true}
            width={432}
            flex={1}
            alignment='center'
        >
            <NewSearch/>
        </Flex>
    );
};

export default GlobalSearchNav;
