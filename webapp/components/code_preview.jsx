// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import PropTypes from 'prop-types';
import React from 'react';

import * as SyntaxHighlighting from 'utils/syntax_highlighting.jsx';
import Constants from 'utils/constants.jsx';

import FileInfoPreview from './file_info_preview.jsx';

import loadingGif from 'images/load.gif';

export default class CodePreview extends React.Component {
    constructor(props) {
        super(props);

        this.updateStateFromProps = this.updateStateFromProps.bind(this);
        this.handleReceivedError = this.handleReceivedError.bind(this);
        this.handleReceivedCode = this.handleReceivedCode.bind(this);

        this.state = {
            code: '',
            lang: '',
            loading: true,
            success: true
        };
    }

    componentDidMount() {
        this.updateStateFromProps(this.props);
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.fileUrl !== nextProps.fileUrl) {
            this.updateStateFromProps(nextProps);
        }
    }

    updateStateFromProps(props) {
        const usedLanguage = SyntaxHighlighting.getLanguageFromFileExtension(props.fileInfo.extension);

        if (!usedLanguage || props.fileInfo.size > Constants.CODE_PREVIEW_MAX_FILE_SIZE) {
            this.setState({code: '', lang: '', loading: false, success: false});
            return;
        }

        this.setState({code: '', lang: usedLanguage, loading: true});

        $.ajax({
            async: true,
            url: props.fileUrl,
            type: 'GET',
            dataType: 'text',
            error: this.handleReceivedError,
            success: this.handleReceivedCode
        });
    }

    handleReceivedCode(data) {
        let code = data;
        if (data.nodeName === '#document') {
            code = new XMLSerializer().serializeToString(data);
        }
        this.setState({
            code,
            loading: false,
            success: true
        });
    }

    handleReceivedError() {
        this.setState({loading: false, success: false});
    }

    static supports(fileInfo) {
        return Boolean(SyntaxHighlighting.getLanguageFromFileExtension(fileInfo.extension));
    }

    render() {
        if (this.state.loading) {
            return (
                <div className='view-image__loading'>
                    <img
                        className='loader-image'
                        src={loadingGif}
                    />
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

        // add line numbers when viewing a code file preview
        const lines = this.state.code.match(/\r\n|\r|\n|$/g).length;
        let strlines = '';
        for (let i = 1; i <= lines; i++) {
            if (strlines) {
                strlines += '\n' + i;
            } else {
                strlines += i;
            }
        }

        const language = SyntaxHighlighting.getLanguageName(this.state.lang);

        const highlighted = SyntaxHighlighting.highlight(this.state.lang, this.state.code);

        return (
            <div className='post-code'>
                <span className='post-code__language'>
                    {`${this.props.fileInfo.name} - ${language}`}
                </span>
                <div className='post-code__container'>
                    <code className='hljs'>
                        <table>
                            <tbody>
                                <tr>
                                    <td className='post-code__lineno'>{strlines}</td>
                                    <td dangerouslySetInnerHTML={{__html: highlighted}}/>
                                </tr>
                            </tbody>
                        </table>
                    </code>
                </div>
            </div>
        );
    }
}

CodePreview.propTypes = {
    fileInfo: PropTypes.object.isRequired,
    fileUrl: PropTypes.string.isRequired
};
