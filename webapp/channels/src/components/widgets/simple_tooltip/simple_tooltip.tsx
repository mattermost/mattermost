// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useMemo} from 'react';
import type {ReactNode, ComponentProps, CSSProperties} from 'react';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

type Props = {
    id?: string;
    content: ReactNode;
    children: ReactNode;
    className?: string;
    arrowOffsetTop?: number | string;
    style?: CSSProperties;
}

const SimpleTooltip = ({
    id,
    content,
    children,
    placement = 'top',
    className = 'hidden-xs',
    delayShow = 500,
    style,
    ...props
}: Props & Omit<ComponentProps<typeof OverlayTrigger>, 'overlay'>) => {
    return (
        <OverlayTrigger
            {...props}
            delayShow={delayShow}
            placement={placement}
            overlay={
                <Tooltip
                    id={id}
                    style={style}
                    className={className}
                    placement={placement}
                >
                    {content}
                </Tooltip>
            }
        >
            {children}
        </OverlayTrigger>
    );
};

export default SimpleTooltip;

export function useSynchronizedImmediate(): [Partial<ComponentProps<typeof SimpleTooltip>>, (isImmediate: boolean) => void] {
    const [isImmediate, setImmediate] = useState(false);

    return [
        useMemo((): Partial<ComponentProps<typeof SimpleTooltip>> => ({
            onEntered: () => setImmediate(true),
            animation: !isImmediate,
            delayShow: isImmediate ? 0 : undefined,
        }), [isImmediate, setImmediate]),
        setImmediate,
    ];
}
