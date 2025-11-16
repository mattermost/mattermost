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
        const usedLanguage = SyntaxHighlighting.getLanguageFromFileExtension(fileInfo.extension);

        if (!usedLanguage || fileInfo.size > Constants.CODE_PREVIEW_MAX_FILE_SIZE) {
            setCodeInfo({code: '', lang: '', highlighted: ''});
            setStatus('fail');
        };

        const getCode = async () => {
            if (shouldNotGetCode) {
                return;
            }
            try {
                const data = await fetch(fileUrl);
                if (!data.ok) {
                    // Handle HTTP error responses (including 423 Locked from plugin rejection)
                    console.error('[CodePreview] Failed to fetch file:', data.status, data.statusText);
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
