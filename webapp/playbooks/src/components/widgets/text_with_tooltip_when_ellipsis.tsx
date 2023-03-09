// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    MutableRefObject,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';
import {debounce} from 'debounce';

import {OVERLAY_DELAY} from 'src/constants';

interface Props {
    id: string;
    text: string;
    parentRef: MutableRefObject<HTMLElement|null>;
    className?: string;
    placement?: 'top' | 'bottom' | 'right' | 'left';
}

const TextWithTooltipWhenEllipsis = (props: Props) => {
    const ref = useRef<HTMLElement|null>(null);
    const [showTooltip, setShowTooltip] = useState(false);

    const resizeListener = useMemo(() => debounce(() => {
        const parentWidth = (props.parentRef?.current && props.parentRef.current.offsetWidth) || 0;
        if (ref?.current && ref.current.offsetWidth > parentWidth) {
            setShowTooltip(true);
        } else {
            setShowTooltip(false);
        }
    }, 300), []);

    useEffect(() => {
        window.addEventListener('resize', resizeListener);

        // clean up function
        return () => {
            window.removeEventListener('resize', resizeListener);
        };
    }, []);

    useEffect(() => {
        resizeListener();
    });

    // Clean up the debounce handler on unmount.
    useEffect(() => resizeListener.clear);

    const text = (
        <span
            ref={ref}
            className={props.className}
        >
            {props.text}
        </span>
    );

    if (showTooltip) {
        return (
            <OverlayTrigger
                placement={props.placement || 'top'}
                delay={OVERLAY_DELAY}
                overlay={<Tooltip id={`${props.id}_name`}>{props.text}</Tooltip>}
            >
                {text}
            </OverlayTrigger>
        );
    }

    return text;
};

export default TextWithTooltipWhenEllipsis;
