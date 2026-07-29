// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

export interface MarkdownListOrderedProps extends React.OlHTMLAttributes<HTMLOListElement> {}

export default function MarkdownListOrdered({children, start = 1, ...otherProps}: MarkdownListOrderedProps) {
    const end = (start + React.Children.count(children)) - 1;

    const style = useMemo<React.CSSProperties>(() => {
        const digits = end.toString().length;

        // Add 1.5 characters to account for the width of the decimal and two spaces. There's a chance that this
        // doesn't work on all fonts, but it works at least with the default one
        const markerWidth = `${digits + 1.5}ch`;

        return {
            counterReset: `list ${start - 1}`,

            // Leave space for the item numbers
            paddingLeft: markerWidth,
        };
    }, [end, start]);

    return (
        <ol
            start={start}
            style={style}
            {...otherProps}
        >
            {children}
        </ol>
    );
}
