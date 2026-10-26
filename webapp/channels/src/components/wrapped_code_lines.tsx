// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

import * as SyntaxHighlighting from 'utils/syntax_highlighting';

type Props = {
    html: string;
};

// Rebuilds highlighted HTML as React elements instead of injecting it, so nothing but text and class-only spans can ever
// reach the DOM, however the markup was produced. The parser doesn't run scripts or load resources.
function renderHighlightedNodes(nodes: NodeListOf<ChildNode>): React.ReactNode[] {
    return Array.from(nodes).map((node, index) => {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
        }

        if (node instanceof HTMLSpanElement) {
            return (
                <span
                    key={index}
                    className={node.getAttribute('class') ?? undefined}
                >
                    {renderHighlightedNodes(node.childNodes)}
                </span>
            );
        }

        return node.textContent;
    });
}

function renderHighlightedLine(line: string): React.ReactNode[] {
    return renderHighlightedNodes(new DOMParser().parseFromString(line, 'text/html').body.childNodes);
}

// Renders each line as its own row so a line number stays beside the first row of its line when the line wraps.
// Rows are spans (laid out by CSS) because a code element can only hold phrasing content.
const WrappedCodeLines = ({html}: Props) => {
    const lines = useMemo(() => SyntaxHighlighting.splitHighlightedLines(html), [html]);

    return (
        <code className='post-code__wrapped-lines'>
            {lines.map((line, index) => (
                <span
                    key={index}
                    className='post-code__line'
                >
                    <span className='post-code__line-number'>{index + 1}</span>
                    <span className='post-code__line-text'>{renderHighlightedLine(line)}</span>
                </span>
            ))}
        </code>
    );
};

export default React.memo(WrappedCodeLines);
