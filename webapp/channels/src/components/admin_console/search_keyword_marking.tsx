// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import Mark from 'mark.js';
import React, {useEffect, useMemo, useRef} from 'react';
import type {ReactNode} from 'react';

type Props = {
    keyword?: string;
    pathname?: string;
    children: ReactNode;
}

const DEBOUNCE_WAIT_TIME = 200;

export default function SearchKeywordMarking({
    keyword = '',
    pathname,
    children,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const markJsRef = useRef<Mark>();

    function doMark(keyword: string, container: HTMLDivElement) {
        markJsRef.current = new Mark(container);
        markJsRef.current.mark(keyword, {
            accuracy: 'complementary',
            exclude: ['.ignore-marking *'],
        });
    }

    const debouncedDoMark = useMemo(() => debounce((keywordToMark?: string, markJs?: Mark, container?: HTMLDivElement | null) => {
        if (!keywordToMark || !container) {
            return;
        }

        if (markJs) {
            // We need to mark again only after its 'done' callback is called
            // if we dont then there is a possiblity of creating multiple marks in the same container
            markJs.unmark({done: () => doMark(keywordToMark, container)});
        } else {
            // If there's no previous instance, just create a new one
            doMark(keywordToMark, container);
        }
    }, DEBOUNCE_WAIT_TIME), []);

    useEffect(() => {
        debouncedDoMark(keyword, markJsRef.current, containerRef.current);

        return (() => {
            debouncedDoMark.cancel();

            if (markJsRef.current) {
                markJsRef.current.unmark();
            }
        });
    }, [keyword, pathname]);

    return (
        <div ref={containerRef}>
            {children}
        </div>
    );
}
