// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useLayoutEffect, useState} from 'react';

import type {FileInfo} from '@mattermost/types/files';

import FileInfoPreview from 'components/file_info_preview';
import Markdown from 'components/markdown';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import Constants from 'utils/constants';
import * as SyntaxHighlighting from 'utils/syntax_highlighting';

import type {LinkInfo} from './file_preview_modal/types';

import './markdown_preview.scss';

type Props = {
    fileInfo: FileInfo;
    fileUrl: string;
    getContent?: (content: string) => void;
};

export function isMarkdownFile(fileInfo: FileInfo | LinkInfo) {
    return SyntaxHighlighting.getLanguageFromFileExtension(fileInfo.extension) === 'markdown';
}

const MarkdownPreview = ({
    fileInfo,
    fileUrl,
    getContent,
}: Props) => {
    const [content, setContent] = useState('');
    const [status, setStatus] = useState<'success' | 'loading' | 'fail'>('loading');

    // Clear parent copy state before paint when the selected file changes.
    useLayoutEffect(() => {
        getContent?.('');
    }, [fileUrl, getContent]);

    useEffect(() => {
        let cancelled = false;

        if (fileInfo.size > Constants.CODE_PREVIEW_MAX_FILE_SIZE) {
            setContent('');
            setStatus('fail');
            getContent?.('');
            return () => {
                cancelled = true;
            };
        }

        setContent('');
        setStatus('loading');

        const fetchContent = async () => {
            try {
                const response = await fetch(fileUrl);
                if (!response.ok) {
                    if (!cancelled) {
                        setStatus('fail');
                        getContent?.('');
                    }
                    return;
                }

                const text = await response.text();
                if (cancelled) {
                    return;
                }

                getContent?.(text);
                setContent(text);
                setStatus('success');
            } catch {
                if (!cancelled) {
                    setStatus('fail');
                    getContent?.('');
                }
            }
        };

        fetchContent();

        return () => {
            cancelled = true;
        };
    }, [fileUrl, fileInfo.size, getContent]);

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

    return (
        <div className='markdown-preview'>
            <span className='markdown-preview__filename'>
                {fileInfo.name}
            </span>
            <div className='markdown-preview__content'>
                <Markdown
                    message={content}
                    options={{
                        atMentions: false,
                        mentionHighlight: false,
                    }}
                />
            </div>
        </div>
    );
};

export default React.memo(MarkdownPreview);
