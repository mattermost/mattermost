// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import type {MouseEvent} from 'react';
import {NavLink} from 'react-router-dom';

import {getHistory} from 'utils/browser_history';

type Props = {
    id?: string;
    activeClassName?: string;

    // Bool whether navigation is blocked
    blocked: boolean;

    // String Link destination
    to: string;
    actions: {

        // Function for deferring navigation while blocked
        deferNavigation: (func: () => void) => void;
    };
    children?: string | React.ReactNode;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
};

const BlockableLink = ({blocked, actions, onClick, to, ...restProps}: Props) => {
    const handleClick = useCallback((e: MouseEvent) => {
        onClick?.(e);

        if (blocked) {
            e.preventDefault();
            actions.deferNavigation(() => {
                getHistory().push(to);
            });
        }
    }, [actions, blocked, onClick, to]);

    return (
        <NavLink
            {...restProps}
            to={to}
            onClick={handleClick}
        />
    );
};

export default React.memo(BlockableLink);
