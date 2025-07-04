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
    className: string;
    getContent?: (code: string) => void;
};

export function supports(fileInfo: FileInfo | LinkInfo) {
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

    const [status, setStatus] = useState({loading: true, success: true});
    const [prevFileUrl, setPrevFileUrl] = useState<string | undefined>();

    if (fileUrl !== prevFileUrl) {
        const usedLanguage = SyntaxHighlighting.getLanguageFromFileExtension(fileInfo.extension);

        if (!usedLanguage || fileInfo.size > Constants.CODE_PREVIEW_MAX_FILE_SIZE) {
            setCodeInfo({...codeInfo, code: '', lang: ''});

            setStatus({loading: false, success: false});
        } else {
            setCodeInfo({...codeInfo, code: '', lang: usedLanguage});

            setStatus({...status, loading: true});
        }

        setPrevFileUrl(fileUrl);
    }

    // This 'useEffect' handles the 'componentDidMount' and 'componentDidUpdate' (because
    // 'componentDidUpdate' also calls 'getCode()' if 'fileUrl' changes but that's already passed
    // in the dependency array, so 'getCode()' will be called if 'fileUrl' prop changes).
    useEffect(() => {
        const handleReceivedCode = async (data: string | Node) => {
            let code = data as string;
            const Data = data as Node;

            if (Data.nodeName === '#document') {
                code = new XMLSerializer().serializeToString(Data);
            }

            getContent?.(code);

            setCodeInfo({
                ...codeInfo,
                code,
                highlighted: await SyntaxHighlighting.highlight(codeInfo.lang, code),
            });

            setStatus({loading: false, success: true});
        };

        const handleReceivedError = () => {
            setStatus({loading: false, success: false});
        };

        const getCode = async () => {
            if (
                !codeInfo.lang ||
                fileInfo.size > Constants.CODE_PREVIEW_MAX_FILE_SIZE
            ) {
                return;
            }
            try {
                const data = await fetch(fileUrl);
                const text = await data.text();
                handleReceivedCode(text);
            } catch (e) {
                handleReceivedError();
            }
        };

        getCode();
    }, [codeInfo, fileInfo.size, fileUrl, getContent]);

    if (status.loading) {
        return (
            <div className='view-image__loading'>
                <LoadingSpinner/>
            </div>
        );
    }

    if (!status.success) {
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
