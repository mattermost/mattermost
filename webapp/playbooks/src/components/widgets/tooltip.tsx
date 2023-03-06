// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {CSSProperties, ComponentProps, ReactNode} from 'react';
import {Tooltip as InnerTooltip, OverlayTrigger} from 'react-bootstrap';

import {OVERLAY_DELAY} from 'src/constants';

type Props = {
    id: string;
    content: ReactNode;
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
}

const Tooltip = ({
    id,
    content,
    children,
    placement = 'top',
    className = 'hidden-xs',
    delay = OVERLAY_DELAY,
    style,
    ...props
}: Props & Omit<ComponentProps<typeof OverlayTrigger>, 'overlay'>) => {
    return (
        <OverlayTrigger
            {...props}
            delay={delay}
            placement={placement}
            overlay={
                <InnerTooltip
                    id={id}
                    style={style}
                    className={className}
                    placement={placement}
                >
                    {content}
                </InnerTooltip>
            }
        >
            {children}
        </OverlayTrigger>
    );
};

export default Tooltip;
