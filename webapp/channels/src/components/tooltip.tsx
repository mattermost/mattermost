// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {CSSProperties} from 'react';
import {Tooltip as RBTooltip} from 'react-bootstrap';

type Props = {
    id?: string;
    className?: string;
    style?: CSSProperties;
    children?: React.ReactNode;
    positionLeft?: number;
    placement?: string;
};

/**
 * @deprecated Use (and expand when extrictly needed) WithTooltip instead
 */
export default function Tooltip(props: Props) {
    return (
        <RBTooltip
            id={props.id}
            className={props.className}
            positionLeft={props.positionLeft}
            style={props.style}
            placement={props.placement}
        >
            {props.children}
        </RBTooltip>
    );
}
