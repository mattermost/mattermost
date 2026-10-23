// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {createContext, useCallback, useContext, useEffect, useMemo, useState, type JSX} from 'react';
import {useSelector} from 'react-redux';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';

import LocalStorageStore from 'stores/local_storage_store';

import CopyButton from 'components/copy_button';
import Markdown from 'components/markdown';
import MarkdownViewToggle from 'components/markdown_view_toggle/markdown_view_toggle';

import PluggableErrorBoundary from 'plugins/pluggable/error_boundary';
import {MarkdownViews} from 'utils/constants';
import type {MarkdownView} from 'utils/constants';
import {isLikelyMarkdown} from 'utils/is_likely_markdown';
import * as SyntaxHighlighting from 'utils/syntax_highlighting';
import * as TextFormatting from 'utils/text_formatting';

import type {GlobalState} from 'types/store';

type Props = {
    code: string;
    language: string;
    searchedContent?: string;
};

// Markdown rendered from inside a code block must not offer its own toggle
const CodeBlockDepthContext = createContext(0);

const CodeBlock: React.FC<Props> = ({code, language, searchedContent}: Props) => {
    const currentUserId = useSelector(getCurrentUserId);
    const depth = useContext(CodeBlockDepthContext);

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

    // Search results highlight matches in the source, which rendering would lose, so they stay raw
    const canToggleMarkdown = depth === 0 && !searchedContent && (SyntaxHighlighting.isMarkdownLanguage(usedLanguage) || detectedMarkdown);

    // The saved preference is read when the block becomes toggleable, and a click overrides it for this block
    const storedMarkdownView = useMemo(() => (canToggleMarkdown ? LocalStorageStore.getMarkdownCodeBlockView(currentUserId) : MarkdownViews.RAW), [canToggleMarkdown, currentUserId]);
    const [chosenMarkdownView, setChosenMarkdownView] = useState<MarkdownView | null>(null);
    const markdownView = chosenMarkdownView ?? storedMarkdownView;
    const showRendered = canToggleMarkdown && markdownView === MarkdownViews.RENDERED;

    const handleMarkdownViewChange = (view: MarkdownView) => {
        LocalStorageStore.setMarkdownCodeBlockView(currentUserId, view);
        setChosenMarkdownView(view);
    };

    // Markdown is prose, so wrap it; the separate line number column can't follow wrapped lines
    const wrapLines = !usedLanguage || SyntaxHighlighting.isMarkdownLanguage(usedLanguage);

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
        if (!SyntaxHighlighting.isMarkdownLanguage(usedLanguage)) {
            lineNumbers = (
                <div className='post-code__line-numbers'>
                    {SyntaxHighlighting.renderLineNumbers(code)}
                </div>
            );
        }
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
            data-markdown-source={showRendered ? code : undefined}
        >
            <div className='post-code__overlay'>
                {canToggleMarkdown && (
                    <MarkdownViewToggle
                        className='post-code__markdown-toggle'
                        size='compact'
                        view={showRendered ? MarkdownViews.RENDERED : MarkdownViews.RAW}
                        onChange={handleMarkdownViewChange}
                    />
                )}
                <CopyButton content={code}/>
                {pluginItems}
                {header}
            </div>
            {showRendered ? (
                <div className='post-code__rendered'>
                    <CodeBlockDepthContext.Provider value={depth + 1}>
                        <Markdown message={code}/>
                    </CodeBlockDepthContext.Provider>
                </div>
            ) : (
                <div className='hljs'>
                    {lineNumbers}
                    <code dangerouslySetInnerHTML={{__html: htmlContent}}/>
                </div>
            )}
        </div>
    );
};

export default CodeBlock;
