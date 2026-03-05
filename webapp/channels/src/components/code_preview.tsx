// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import type {FileInfo} from '@mattermost/types/files';

import FileInfoPreview from 'components/file_info_preview';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import Constants from 'utils/constants';
import * as SyntaxHighlighting from 'utils/syntax_highlighting';

import type {LinkInfo} from './file_preview_modal/types';

type Props = {
    fileInfo: FileInfo;
    fileUrl: string;
    getContent?: (code: string) => void;
};

export function hasSupportedLanguage(fileInfo: FileInfo | LinkInfo) {
    return Boolean(SyntaxHighlighting.getLanguageFromFileExtension(fileInfo.extension));
}

const CodePreview = ({
    fileInfo,
    fileUrl,
    getContent,
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
            } catch (e) {
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

    const language = SyntaxHighlighting.getLanguageName(codeInfo.lang);

    return (
        <div className='post-code code-preview'>
            <span className='post-code__language'>
                {`${fileInfo.name} - ${language}`}
            </span>
            <div className='hljs'>
                <div className='post-code__line-numbers'>
                    {SyntaxHighlighting.renderLineNumbers(codeInfo.code)}
                </div>
                <code dangerouslySetInnerHTML={{__html: codeInfo.highlighted}}/>
            </div>
        </div>
    );
};

export default React.memo(CodePreview);
