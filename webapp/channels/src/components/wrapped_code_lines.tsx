// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

import * as SyntaxHighlighting from 'utils/syntax_highlighting';

type Props = {
    html: string;
};

// Renders each line as its own row so a line number stays beside the first row of its line when the line wraps
const WrappedCodeLines = ({html}: Props) => {
    const lines = useMemo(() => SyntaxHighlighting.splitHighlightedLines(html), [html]);

    return (
        <code className='post-code__wrapped-lines'>
            {lines.map((line, index) => (
                <div
                    key={index}
                    className='post-code__line'
                >
                    <span className='post-code__line-number'>{index + 1}</span>
                    <span
                        className='post-code__line-text'
                        dangerouslySetInnerHTML={{__html: line}}
                    />
                </div>
            ))}
        </code>
    );
};

export default React.memo(WrappedCodeLines);
