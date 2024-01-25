// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {useSelector} from 'react-redux';

import CopyButton from 'components/copy_button';

import * as SyntaxHighlighting from 'utils/syntax_highlighting';
import * as TextFormatting from 'utils/text_formatting';

import type {GlobalState} from 'types/store';

type Props = {
    code: string;
    language: string;
    searchedContent?: string;
}

const CodeBlock: React.FC<Props> = ({code, language, searchedContent}: Props) => {
    const getUsedLanguage = useCallback(() => {
        let usedLanguage = language || '';
        usedLanguage = usedLanguage.toLowerCase();

        if (usedLanguage === 'texcode' || usedLanguage === 'latexcode') {
            usedLanguage = 'latex';
        }

        // treat html as xml to prevent injection attacks
        if (usedLanguage === 'html') {
            usedLanguage = 'xml';
        }

        return usedLanguage;
    }, [language]);

    const usedLanguage = getUsedLanguage();

    let className = 'post-code';
    if (!usedLanguage) {
        className += ' post-code--wrap';
    }

    let header: JSX.Element = <></>;
    let lineNumbers: JSX.Element = <></>;
    if (SyntaxHighlighting.canHighlight(usedLanguage)) {
        header = (
            <span className='post-code__language'>
                {SyntaxHighlighting.getLanguageName(usedLanguage)}
            </span>
        );
        lineNumbers = (
            <div className='post-code__line-numbers'>
                {SyntaxHighlighting.renderLineNumbers(code)}
            </div>
        );
    }

    // If we have to apply syntax highlighting AND highlighting of search terms, create two copies
    // of the code block, one with syntax highlighting applied and another with invisible text, but
    // search term highlighting and overlap them
    const [content, setContent] = useState(TextFormatting.sanitizeHtml(code));
    useEffect(() => {
        SyntaxHighlighting.highlight(usedLanguage, code).then((content) => setContent(content));
    }, [usedLanguage, code]);

    let htmlContent = content;
    if (searchedContent) {
        htmlContent = searchedContent + content;
    }

    const codeBlockActions = useSelector((state: GlobalState) => state.plugins.components.CodeBlockAction);
    const pluginItems = codeBlockActions?.
        map((item) => {
            if (!item.component) {
                return null;
            }

            const Component = item.component as any;
            return (
                <Component
                    key={item.id}
                    code={code}
                />
            );
        });

    return (
        <div className={className}>
            <div className='post-code__overlay'>
                <CopyButton content={code}/>
                {pluginItems}
                {header}
            </div>
            <div className='hljs'>
                {lineNumbers}
                <code dangerouslySetInnerHTML={{__html: htmlContent}}/>
            </div>
        </div>
    );
};

export default CodeBlock;
