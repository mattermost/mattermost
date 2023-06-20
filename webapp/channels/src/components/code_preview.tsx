// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Constants from 'utils/constants';
import * as SyntaxHighlighting from 'utils/syntax_highlighting';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';
import FileInfoPreview from 'components/file_info_preview';

import {FileInfo} from '@mattermost/types/files';

import {LinkInfo} from './file_preview_modal/types';

type Props = {
    fileInfo: FileInfo;
    fileUrl: string;
    className: string;
    getContent?: (code: string) => void;
};

type State = {
    code: string;
    lang: string;
    highlighted: string;
    loading: boolean;
    success: boolean;
    prevFileUrl?: string;
}

export default class CodePreview extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            code: '',
            lang: '',
            highlighted: '',
            loading: true,
            success: true,
        };
    }

    componentDidMount() {
        this.getCode();
    }

    static getDerivedStateFromProps(props: Props, state: State) {
        if (props.fileUrl !== state.prevFileUrl) {
            const usedLanguage = SyntaxHighlighting.getLanguageFromFileExtension(props.fileInfo.extension);

            if (!usedLanguage || props.fileInfo.size > Constants.CODE_PREVIEW_MAX_FILE_SIZE) {
                return {
                    code: '',
                    lang: '',
                    loading: false,
                    success: false,
                    prevFileUrl: props.fileUrl,
                };
            }

            return {
                code: '',
                lang: usedLanguage,
                loading: true,
                prevFileUrl: props.fileUrl,
            };
        }
        return null;
    }

    componentDidUpdate(prevProps: Props) {
        if (this.props.fileUrl !== prevProps.fileUrl) {
            this.getCode();
        }
    }

    getCode = async () => {
        if (!this.state.lang || this.props.fileInfo.size > Constants.CODE_PREVIEW_MAX_FILE_SIZE) {
            return;
        }
        try {
            const data = await fetch(this.props.fileUrl);
            const text = await data.text();
            this.handleReceivedCode(text);
        } catch (e) {
            this.handleReceivedError();
        }
    };

    handleReceivedCode = async (data: string | Node) => {
        let code = data as string;
        const Data = data as Node;
        if (Data.nodeName === '#document') {
            code = new XMLSerializer().serializeToString(Data);
        }
        this.props.getContent?.(code);
        this.setState({
            code,
            highlighted: await SyntaxHighlighting.highlight(this.state.lang, code),
            loading: false,
            success: true,
        });
    };

    handleReceivedError = () => {
        this.setState({loading: false, success: false});
    };

    static supports(fileInfo: FileInfo | LinkInfo) {
        return Boolean(SyntaxHighlighting.getLanguageFromFileExtension(fileInfo.extension));
    }

    render() {
        if (this.state.loading) {
            return (
                <div className='view-image__loading'>
                    <LoadingSpinner/>
                </div>
            );
        }

        if (!this.state.success) {
            return (
                <FileInfoPreview
                    fileInfo={this.props.fileInfo}
                    fileUrl={this.props.fileUrl}
                />
            );
        }

        const language = SyntaxHighlighting.getLanguageName(this.state.lang);

        return (
            <div className='post-code code-preview'>
                <span className='post-code__language'>
                    {`${this.props.fileInfo.name} - ${language}`}
                </span>
                <div className='hljs'>
                    <div className='post-code__line-numbers'>
                        {SyntaxHighlighting.renderLineNumbers(this.state.code)}
                    </div>
                    <code dangerouslySetInnerHTML={{__html: this.state.highlighted}}/>
                </div>
            </div>
        );
    }
}
