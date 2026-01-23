// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import type {MouseEvent} from 'react';

type Props = {
    id?: string;
    activeClassName?: string;

    // Bool whether navigation is blocked
    blocked: boolean;

    actions: {

        // Function for deferring navigation while blocked
        deferNavigation: (func: () => void) => void;
    };
    children?: React.ReactNode;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
    onCancelConfirmed: () => void;
};

const BlockableButton = ({blocked, actions, onClick, onCancelConfirmed, ...restProps}: Props) => {
    const handleClick = useCallback((e: MouseEvent) => {
        onClick?.(e);

        if (blocked) {
            e.preventDefault();
            actions.deferNavigation(() => {
                onCancelConfirmed();
            });
        }
    }, [actions, blocked, onClick, onCancelConfirmed]);

    return (
        <button
            {...restProps}
            onClick={handleClick}
        />
    );
};

export default React.memo(BlockableButton);
