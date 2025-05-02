// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {useHistory, useLocation} from 'react-router-dom';

import {deferNavigation} from 'actions/admin_actions';

import type {GlobalState} from 'types/store';

import type {Props as MenuItemProps} from './menu_item';
import {MenuItem} from './menu_item';

import {getNavigationBlocked} from '../../selectors/views/admin';

type Props = MenuItemProps & {
    to: string;
    onClick?: MenuItemProps['onClick'];
}

export function MenuItemLink({
    to,
    onClick,
    ...otherProps
}: Props) {
    const dispatch = useDispatch();
    const history = useHistory();
    const {pathname} = useLocation();

    const blocked = useSelector((state: GlobalState) => pathname.startsWith('/admin_console') && getNavigationBlocked(state));

    const handleClick: MenuItemProps['onClick'] = useCallback((e) => {
        onClick?.(e);

        if (blocked) {
            e.preventDefault();
            dispatch(deferNavigation(() => {
                history.push(to);
            }));
        } else {
            history.push(to);
        }
    }, [blocked, onClick, deferNavigation, history.push, to]);

    return (
        <MenuItem
            onClick={handleClick}
            {...otherProps}
        />
    );
}
