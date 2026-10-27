// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMergeRefs} from '@floating-ui/react';
import {ClickScrollPlugin, OverlayScrollbars, type PartialOptions} from 'overlayscrollbars';
import {useOverlayScrollbars} from 'overlayscrollbars-react';
import React, {useCallback, useEffect, useRef} from 'react';
import {useIntl} from 'react-intl';

import 'overlayscrollbars/overlayscrollbars.css';
import './scrollbars.scss';

OverlayScrollbars.plugin(ClickScrollPlugin);

const options: PartialOptions = {
    scrollbars: {
        theme: 'os-theme-mattermost',
        autoHide: 'move',
        clickScroll: true,
    },
};

export type ScrollbarsProps = {
    children: React.ReactNode;
    color?: string;
    onScroll?: (e: Event) => void;
};

const Scrollbars = React.forwardRef<HTMLElement, ScrollbarsProps>(({
    children,
    color,
    onScroll,
}, ref) => {
    const {formatMessage} = useIntl();

    const hostRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);

    const [initialize] = useOverlayScrollbars({options});

    // Rendering the viewport ourselves keeps the scrollable element available to the ref on mount
    useEffect(() => {
        initialize({
            target: hostRef.current!,
            elements: {
                viewport: viewportRef.current,
                content: viewportRef.current,
            },
        });
    }, [initialize]);

    const removeListener = useRef<() => void>(undefined);

    // Callers expect a native scroll event rather than a React synthetic one
    const setScrollRef = useCallback((el: HTMLDivElement) => {
        removeListener.current?.();
        removeListener.current = undefined;

        if (el && onScroll) {
            el.addEventListener('scroll', onScroll);

            removeListener.current = () => el.removeEventListener('scroll', onScroll);
        }
    }, [onScroll]);

    const mergedRef = useMergeRefs<HTMLElement>([ref, viewportRef, setScrollRef]);

    return (
        <div
            ref={hostRef}
            className='Scrollbars'
            data-overlayscrollbars-initialize=''
            style={{
                '--scrollbar-color': `var(${color})`,
            } as React.CSSProperties}
        >
            <div
                ref={mergedRef}
                aria-label={formatMessage({id: 'scrollbars.ariaLabel', defaultMessage: 'Scrollable content'})}
                role='region'
                tabIndex={-1}
            >
                {children}
            </div>
        </div>
    );
});
Scrollbars.displayName = 'Scrollbars';
export default Scrollbars;
