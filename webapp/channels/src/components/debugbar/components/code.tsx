// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useEffect, useState} from 'react';
import cn from 'classnames';
import styled from 'styled-components';

import * as SyntaxHighlighting from 'utils/syntax_highlighting';
import * as TextFormatting from 'utils/text_formatting';

import 'highlight.js/lib/languages/json';

const Block = styled.div`
    border: 0;
    background: none;
    white-space: pre-wrap;
`;

type Props = {
    code: string;
    language: string;
    inline?: boolean;
}

function Code({code, language, inline = true}: Props) {
    const [content, setContent] = useState(TextFormatting.sanitizeHtml(code));

    useEffect(() => {
        SyntaxHighlighting.highlight(language, code).then((content) =>
            setContent(inline ? content : content.replaceAll(/\n/gm, '<br />')),
        );
    }, [language, code, inline]);

    return (
        <Block
            className={cn({inline})}
            dangerouslySetInnerHTML={{__html: content}}
        />
    );
}

export default memo(Code);
