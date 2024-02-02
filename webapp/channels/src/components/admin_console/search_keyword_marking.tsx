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

const DEBOUNCE_WAIT_TIME = 300;

function SearchKeywordMarking(props: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const markJsRef = useRef<Mark>();

    function doMark(keyword: string) {
        markJsRef.current = new Mark(containerRef.current as HTMLDivElement);
        markJsRef.current.mark(keyword, {
            accuracy: 'complementary',
            exclude: ['.ignore-marking *'],
        });
    }

    const debouncedRedrawHighlight = useMemo(() => debounce(() => {
        if (!props.keyword || !containerRef.current) {
            return;
        }

        if (markJsRef.current) {
            // We need to mark again only after its 'done' callback is called
            markJsRef.current.unmark({done: () => doMark(props.keyword as string)});
        } else {
            // If there's no previous instance, just create a new one
            doMark(props.keyword);
        }
    }, DEBOUNCE_WAIT_TIME), [props.keyword]);

    useEffect(() => {
        debouncedRedrawHighlight();

        return (() => {
            debouncedRedrawHighlight.cancel();

            if (markJsRef.current) {
                markJsRef.current.unmark();
            }
        });
    }, [props.keyword, props.pathname]);

    return (
        <div ref={containerRef}>
            {props.children}
        </div>
    );
}

export default SearchKeywordMarking;
