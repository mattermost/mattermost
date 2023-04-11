// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import Flex from '@mattermost/compass-components/utilities/layout/Flex'; // eslint-disable-line no-restricted-imports

import {closeRightHandSide, showMentions} from 'actions/views/rhs';
import Search from 'components/search';

import {getRhsState} from 'selectors/rhs';

import {GlobalState} from 'types/store';

import {
    Constants,
    RHSStates,
} from 'utils/constants';
import * as Utils from 'utils/utils';

import {Grid} from '@mattermost/compass-ui';
import {getNewUIEnabled} from 'mattermost-redux/selectors/entities/preferences';

const GlobalSearchNav = (): JSX.Element => {
    const dispatch = useDispatch();
    const rhsState = useSelector((state: GlobalState) => getRhsState(state));
    const isNewUI = useSelector(getNewUIEnabled);

    useEffect(() => {
        const handleShortcut = (e: KeyboardEvent) => {
            if (Utils.cmdOrCtrlPressed(e) && e.shiftKey) {
                if (Utils.isKeyPressed(e, Constants.KeyCodes.M)) {
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

    if (isNewUI) {
        return (
            <Grid
                width={432}
                alignItems={'center'}
                flexDirection={'row'}
            >
                <Search enableFindShortcut={true}/>
            </Grid>
        );
    }

    return (
        <Flex
            row={true}
            width={432}
            flex={1}
            alignment='center'
        >
            <Search
                enableFindShortcut={true}
            />
        </Flex>
    );
};

export default GlobalSearchNav;
