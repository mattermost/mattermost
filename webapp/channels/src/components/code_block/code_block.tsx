// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState, type JSX} from 'react';
import {useSelector} from 'react-redux';

import CopyButton from 'components/copy_button';
import MarkdownToggleContext from 'components/markdown_view_toggle/markdown_toggle_context';
import MarkdownViewToggle from 'components/markdown_view_toggle/markdown_view_toggle';
import {useMarkdownView} from 'components/markdown_view_toggle/use_markdown_view';
import WrappedCodeLines from 'components/wrapped_code_lines';

import PluggableErrorBoundary from 'plugins/pluggable/error_boundary';
import {MARKDOWN_SOURCE_ATTRIBUTE, MarkdownViews} from 'utils/constants';
import {isLikelyMarkdown} from 'utils/is_likely_markdown';
import * as SyntaxHighlighting from 'utils/syntax_highlighting';
import * as TextFormatting from 'utils/text_formatting';

import type {GlobalState} from 'types/store';

type Props = {
    code: string;
    language: string;
    searchedContent?: string;
};

// Loaded lazily because Markdown reaches this file again through the LaTeX block, and a static import would make that cycle
// fail to initialise whenever the LaTeX block is the first module loaded
const Markdown = lazy(() => import('components/markdown'));

const CodeBlock: React.FC<Props> = ({code, language, searchedContent}: Props) => {
    const toggleAllowed = useContext(MarkdownToggleContext);

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

    // Untagged blocks are checked too, but an explicit other language is respected
    const detectedMarkdown = useMemo(() => !usedLanguage && isLikelyMarkdown(code), [usedLanguage, code]);

    const isMarkdownSource = SyntaxHighlighting.isMarkdownLanguage(usedLanguage) || detectedMarkdown;

    // Search results highlight matches in the source, which rendering would lose, so they stay raw
    const canToggleMarkdown = toggleAllowed && !searchedContent && isMarkdownSource;

    const [markdownView, setMarkdownView] = useMarkdownView('code_block');
    const showRendered = canToggleMarkdown && markdownView === MarkdownViews.RENDERED;

    // Markdown is prose, so wrap it, with a number on each line rather than one column that wrapped lines would knock out of step.
    // Search highlighting is a second copy of the code laid over the first, so searched blocks keep the plain layout.
    const numberWrappedLines = isMarkdownSource && !searchedContent;
    const wrapLines = !usedLanguage || numberWrappedLines;

    let className = 'post-code';
    if (wrapLines) {
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
        let shouldSetContent = true;

        SyntaxHighlighting.highlight(usedLanguage, code).then((content) => {
            // Ensure the component is still mounted and that usedLanguage and code haven't changed to prevent two
            // highlight calls from racing
            if (shouldSetContent) {
                setContent(content);
            }
        });

        return () => {
            shouldSetContent = false;
        };
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
                <PluggableErrorBoundary
                    key={item.id}
                    pluginId={item.pluginId}
                >
                    <Component
                        code={code}
                    />
                </PluggableErrorBoundary>
            );
        });

    return (
        <div
            className={className}
            {...(showRendered ? {[MARKDOWN_SOURCE_ATTRIBUTE]: code} : {})}
        >
            <div className='post-code__overlay'>
                {canToggleMarkdown && (
                    <MarkdownViewToggle
                        className='post-code__markdown-toggle'
                        size='compact'
                        view={showRendered ? MarkdownViews.RENDERED : MarkdownViews.RAW}
                        onChange={setMarkdownView}
                    />
                )}
                <CopyButton content={code}/>
                {pluginItems}
                {header}
            </div>
            {showRendered ? (
                <div className='post-code__rendered'>
                    <MarkdownToggleContext.Provider value={false}>
                        <Suspense fallback={null}>
                            <Markdown message={code}/>
                        </Suspense>
                    </MarkdownToggleContext.Provider>
                </div>
            ) : (
                <div className='hljs'>
                    {numberWrappedLines ? (
                        <WrappedCodeLines html={htmlContent}/>
                    ) : (
                        <>
                            {lineNumbers}
                            <code dangerouslySetInnerHTML={{__html: htmlContent}}/>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default CodeBlock;
