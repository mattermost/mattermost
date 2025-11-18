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

    useEffect(() => {
        const usedLanguage = SyntaxHighlighting.getLanguageFromFileExtension(fileInfo.extension);

        if (!usedLanguage || fileInfo.size > Constants.CODE_PREVIEW_MAX_FILE_SIZE) {
            setCodeInfo({code: '', lang: '', highlighted: ''});
            setStatus('fail');
            return;
        }

        setCodeInfo({code: '', lang: usedLanguage, highlighted: ''});
        setStatus('loading');

        const fetchCode = async () => {
            try {
                const response = await fetch(fileUrl);
                let code = await response.text();

                if (response.headers.get('content-type')?.includes('xml')) {
                    try {
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(code, 'text/xml');
                        if (xmlDoc.nodeName === '#document') {
                            code = new XMLSerializer().serializeToString(xmlDoc);
                        }
                    } catch {
                        // If XML parsing fails, use the text as-is
                    }
                }

                getContent?.(code);

                const highlighted = await SyntaxHighlighting.highlight(usedLanguage, code);

                setCodeInfo({
                    code,
                    lang: usedLanguage,
                    highlighted,
                });
                setStatus('success');
            } catch (e) {
                setStatus('fail');
            }
        };

        fetchCode();
    }, [fileUrl, fileInfo.extension, fileInfo.size, getContent]);

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
