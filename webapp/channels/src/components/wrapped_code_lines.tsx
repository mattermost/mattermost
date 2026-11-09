// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

type Props = {
    html: string;
};

// What a node contributes to each source line it spans. A span that runs across lines (like a fenced block in Markdown)
// is closed on one line and reopened on the next, each time with the same class.
type Lines = React.ReactNode[][];

// Rebuilds highlighted HTML as React elements, one list per source line, instead of injecting it. The parser doesn't run
// scripts or load resources, and only text and class-only spans are ever turned back into elements, so nothing else
// can reach the DOM however the markup was produced.
function splitIntoLines(nodes: NodeListOf<ChildNode>, nextKey: () => number): Lines {
    const lines: Lines = [[]];

    for (const node of Array.from(nodes)) {
        let covered: Lines;
        if (node instanceof HTMLSpanElement) {
            const className = node.getAttribute('class') ?? undefined;
            covered = splitIntoLines(node.childNodes, nextKey).map((children) => [
                <span
                    key={nextKey()}
                    className={className}
                >
                    {children}
                </span>,
            ]);
        } else {
            covered = (node.textContent ?? '').split(/\r\n|\n|\r/).map((text) => (text ? [text] : []));
        }

        lines[lines.length - 1].push(...covered[0]);
        lines.push(...covered.slice(1));
    }

    return lines;
}

// Renders each line as its own row so a line number stays beside the first row of its line when the line wraps.
// Rows are spans (laid out by CSS) because a code element can only hold phrasing content, and the numbers are CSS
// counters so they aren't part of the text a copy of the block would read.
const WrappedCodeLines = ({html}: Props) => {
    const lines = useMemo(() => {
        let key = 0;
        return splitIntoLines(new DOMParser().parseFromString(html, 'text/html').body.childNodes, () => key++);
    }, [html]);

    return (
        <code className='post-code__wrapped-lines'>
            {lines.map((line, index) => (
                <span
                    key={index}
                    className='post-code__line'
                >
                    <span className='post-code__line-text'>{line}</span>
                </span>
            ))}
        </code>
    );
};

export default React.memo(WrappedCodeLines);
