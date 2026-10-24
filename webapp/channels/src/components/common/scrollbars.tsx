// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMergeRefs} from '@floating-ui/react';
import React, {useCallback, useRef} from 'react';
import SimpleBar from 'simplebar-react';

import 'simplebar-react/dist/simplebar.min.css';
import './scrollbars.scss';

export type ScrollbarsProps = {
    children: React.ReactNode;
    color?: string;
    onScroll?: (e: Event) => void;
};

function isPressOnScrollbarTrack({clientX, clientY}: MouseEvent) {
    for (const track of document.querySelectorAll<HTMLElement>('[data-simplebar] .simplebar-track')) {
        // SimpleBar hides the track inline when that axis isn't overflowing
        if (track.style.visibility === 'hidden') {
            continue;
        }

        const {left, right, top, bottom} = track.getBoundingClientRect();
        if (clientX >= left && clientX <= right && clientY >= top && clientY <= bottom) {
            return true;
        }
    }

    return false;
}

// SimpleBar decides from the pointer coordinates, not from the event target, whether a press belongs
// to its scrollbar. Drag and drop sensors instead look up a drag handle from the target of a window
// level mousedown, so anything that stops the track from being hit tested makes them drag whatever
// sits under the scrollbar thumb. Marking the press as handled keeps them out of it. This is
// registered at module scope so that it runs before the sensors, which bind when DragDropContext
// mounts.
if (typeof window !== 'undefined') {
    window.addEventListener('mousedown', (event) => {
        if (!event.defaultPrevented && isPressOnScrollbarTrack(event)) {
            event.preventDefault();
        }
    }, {capture: true});
}

const Scrollbars = React.forwardRef<HTMLElement, ScrollbarsProps>(({
    children,
    color,
    onScroll,
}, ref) => {
    const removeListener = useRef<() => void>(undefined);

    // We can't pass scroll handlers directly to SimpleBar, so we have to attach it to the DOM element directly
    const setScrollRef = useCallback((el: HTMLDivElement) => {
        removeListener.current?.();
        removeListener.current = undefined;

        if (el && onScroll) {
            el.addEventListener('scroll', onScroll);

            removeListener.current = () => el.removeEventListener('scroll', onScroll);
        }
    }, [onScroll]);

    const mergedRef = useMergeRefs<HTMLElement>([ref, setScrollRef]);

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
Scrollbars.displayName = 'Scrollbars';
export default Scrollbars;
