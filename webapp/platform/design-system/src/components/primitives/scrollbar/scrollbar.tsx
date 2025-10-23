// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMergeRefs} from '@floating-ui/react';
import React, {useCallback, useRef} from 'react';
import SimpleBar from 'simplebar-react';

import 'simplebar-react/dist/simplebar.min.css';
import './scrollbar.scss';

type Props = {
    children: React.ReactNode;
    color?: string;
    onScroll?: (e: Event) => void;
};

const Scrollbar = React.forwardRef<HTMLDivElement, Props>(({
    children,
    color,
    onScroll,
}, ref) => {
    const removeListener = useRef<() => void>();

    // We can't pass scroll handlers directly to SimpleBar, so we have to attach it to the DOM element directly
    const setScrollRef = useCallback((el: HTMLDivElement) => {
        removeListener.current?.();
        removeListener.current = undefined;

        if (el && onScroll) {
            el.addEventListener('scroll', onScroll);

            removeListener.current = () => el.removeEventListener('scroll', onScroll);
        }
    }, [onScroll]);

    const mergedRef = useMergeRefs<HTMLDivElement>([ref, setScrollRef]);

    return (
        <SimpleBar
            autoHide={true}
            scrollableNodeProps={{ref: mergedRef}}
            style={{
                '--scrollbar-color': `var(${color})`,
            } as React.CSSProperties}
            tabIndex={-1}
        >
            {children}
        </SimpleBar>
    );
});

Scrollbar.displayName = 'Scrollbar';
export default Scrollbar;
