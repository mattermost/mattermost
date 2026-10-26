// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useState} from 'react';

import type {FileInfo} from '@mattermost/types/files';

import FileInfoPreview from 'components/file_info_preview';
import Markdown from 'components/markdown';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';
import WrappedCodeLines from 'components/wrapped_code_lines';

import Constants from 'utils/constants';
import * as SyntaxHighlighting from 'utils/syntax_highlighting';

import type {LinkInfo} from './file_preview_modal/types';

type Props = {
    fileInfo: FileInfo;
    fileUrl: string;
    getContent?: (code: string) => void;
    renderMarkdown?: boolean;
};

export function hasSupportedLanguage(fileInfo: FileInfo | LinkInfo) {
    return Boolean(SyntaxHighlighting.getLanguageFromFileExtension(fileInfo.extension));
}

const CodePreview = ({
    fileInfo,
    fileUrl,
    getContent,
    renderMarkdown = false,
}: Props) => {
    const [codeInfo, setCodeInfo] = useState({
        code: '',
        lang: '',
        highlighted: '',
    });

    const [status, setStatus] = useState<'success' | 'loading' | 'fail'>('loading');
    const [prevFileUrl, setPrevFileUrl] = useState<string | undefined>();

    useEffect(() => {
        if (fileUrl !== prevFileUrl) {
            const usedLanguage = SyntaxHighlighting.getLanguageFromFileExtension(fileInfo.extension);

            if (!usedLanguage || fileInfo.size > Constants.CODE_PREVIEW_MAX_FILE_SIZE) {
                setCodeInfo((prevCodeInfo) => {
                    return {...prevCodeInfo, code: '', lang: ''};
                });

                setStatus('fail');
            } else {
                setCodeInfo((prevCodeInfo) => {
                    return {...prevCodeInfo, code: '', lang: usedLanguage};
                });

                setStatus('loading');
            }

            setPrevFileUrl(fileUrl);
        }
    }, [fileInfo.extension, fileInfo.size, fileUrl, prevFileUrl]);

    const shouldNotGetCode = !codeInfo.lang || fileInfo.size > Constants.CODE_PREVIEW_MAX_FILE_SIZE;

    useEffect(() => {
        const usedLanguage = SyntaxHighlighting.getLanguageFromFileExtension(fileInfo.extension);

        if (!usedLanguage || fileInfo.size > Constants.CODE_PREVIEW_MAX_FILE_SIZE) {
            setCodeInfo({code: '', lang: '', highlighted: ''});
            setStatus('fail');
        }

        const handleReceivedCode = async (data: string | Node) => {
            let code = data as string;
            const dataAsNode = data as Node;

            if (dataAsNode.nodeName === '#document') {
                code = new XMLSerializer().serializeToString(dataAsNode);
            }

            getContent?.(code);

            setCodeInfo({
                ...codeInfo,
                code,
                highlighted: await SyntaxHighlighting.highlight(codeInfo.lang, code),
            });

            setStatus('success');
        };

        const handleReceivedError = () => {
            setStatus('fail');
        };

        const getCode = async () => {
            if (shouldNotGetCode) {
                return;
            }
            try {
                const data = await fetch(fileUrl);
                if (!data.ok) {
                    // Handle HTTP error responses (including 403 Forbidden from plugin rejection)
                    handleReceivedError();
                    return;
                }
                const text = await data.text();
                handleReceivedCode(text);
            } catch {
                handleReceivedError();
            }
        };

        // Only fetch if status is loading and we have a language
        if (status === 'loading' && codeInfo.lang && !shouldNotGetCode) {
            getCode();
        }
    }, [codeInfo, fileUrl, prevFileUrl, getContent, shouldNotGetCode, status]);

    if (status === 'loading') {
        return (
            <div className='view-image__loading'>
                <LoadingSpinner/>
            </div>
        );
    }

    if (status === 'fail') {
        return (
            <FileInfoPreview
                fileInfo={fileInfo}
                fileUrl={fileUrl}
            />
        );
    }

    // Markdown files keep one fixed-size box in both views so switching doesn't resize the modal. The label is
    // skipped in both views (not just this one) since adding it to only one would unbalance how much of the fixed
    // box each view's content gets — and the modal header already shows the file name.
    const isMarkdownFile = SyntaxHighlighting.isMarkdownLanguage(codeInfo.lang);

    if (renderMarkdown && isMarkdownFile) {
        return (
            <div className='code-preview code-preview--markdown code-preview--fixed-size'>
                <div className='code-preview__markdown'>
                    <Markdown message={codeInfo.code}/>
                </div>
            </div>
        );
    }

    const language = SyntaxHighlighting.getLanguageName(codeInfo.lang);

    return (
        <div className={classNames('post-code code-preview', {'code-preview--fixed-size code-preview--wrap': isMarkdownFile})}>
            {!isMarkdownFile && (
                <span className='post-code__language'>
                    {`${fileInfo.name} - ${language}`}
                </span>
            )}
            <div className='hljs'>
                {isMarkdownFile ? (
                    <WrappedCodeLines html={codeInfo.highlighted}/>
                ) : (
                    <>
                        <div className='post-code__line-numbers'>
                            {SyntaxHighlighting.renderLineNumbers(codeInfo.code)}
                        </div>
                        <code dangerouslySetInnerHTML={{__html: codeInfo.highlighted}}/>
                    </>
                )}
            </div>
        </div>
    );
};

export default React.memo(CodePreview);
