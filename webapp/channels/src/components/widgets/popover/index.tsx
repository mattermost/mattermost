// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Popover as BSPopover} from 'react-bootstrap';
import type {Sizes as BSSizes} from 'react-bootstrap';

const SizeMap = {xs: 'xsmall', sm: 'small', md: 'medium', lg: 'large'};
export type Sizes = 'xs' | 'sm' | 'md' | 'lg';

interface Props {
    id?: string;
    children?: React.ReactNode;
    popoverStyle?: 'info';
    popoverSize?: Sizes;
    title?: React.ReactNode;
    placement?: 'bottom' | 'top' | 'right' | 'left';
    className?: string;
    style?: React.CSSProperties;
    onMouseOut?: React.MouseEventHandler<BSPopover>; // didn't find a better way to satisfy typing, so for now we have a slight 'bootstrap leakage'
    onMouseOver?: React.MouseEventHandler<BSPopover>;
}

const Popover = React.forwardRef<BSPopover, Props>(({
    placement = 'right',
    popoverSize = 'sm',
    children,
    popoverStyle = 'info',
    title,
    id,
    onMouseOut,
    onMouseOver,
    className,
    style,
}, ref?) => {
    return (
        <BSPopover
            id={id}
            style={style}
            className={className}
            bsStyle={popoverStyle}
            placement={placement}
            bsClass='popover'
            title={title}
            bsSize={popoverSize && SizeMap[popoverSize] as BSSizes} // map our sizes to bootstrap
            onMouseOut={onMouseOut}
            onMouseOver={onMouseOver}
            ref={ref}
        >
            {children}
        </BSPopover>
    );
});

Popover.displayName = 'Popover';

export default React.memo(Popover);
