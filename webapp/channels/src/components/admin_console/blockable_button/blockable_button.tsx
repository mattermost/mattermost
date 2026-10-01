// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {Button, type ButtonEmphasis, type ButtonSize} from '@mattermost/compass-ui/components/button';

import {deferNavigation} from 'actions/admin_actions';
import {getNavigationBlocked} from 'selectors/views/admin';
import {getHistory} from 'utils/browser_history';

type Props = {
    id?: string;
    to: string;
    children: React.ReactNode;
    disabled?: boolean;
    emphasis?: ButtonEmphasis;
    size?: ButtonSize;
    className?: string;
    'data-testid'?: string;
};

/**
 * Compass Button that honors System Console unsaved-changes navigation blocking,
 * mirroring BlockableLink behavior for button (not anchor) cancel controls.
 */
const BlockableButton = ({
    id,
    to,
    children,
    disabled,
    emphasis = 'tertiary',
    size,
    className,
    ...rest
}: Props) => {
    const dispatch = useDispatch();
    const navigationBlocked = useSelector(getNavigationBlocked);

    const handleClick = useCallback(() => {
        if (navigationBlocked) {
            dispatch(deferNavigation(() => {
                getHistory().push(to);
            }));
            return;
        }

        getHistory().push(to);
    }, [dispatch, navigationBlocked, to]);

    return (
        <Button
            id={id}
            type='button'
            emphasis={emphasis}
            size={size}
            className={className}
            disabled={disabled}
            onClick={handleClick}
            {...rest}
        >
            {children}
        </Button>
    );
};

export default BlockableButton;
