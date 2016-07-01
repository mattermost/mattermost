// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import React from 'react';

import * as SyntaxHighlighting from 'utils/syntax_hightlighting.jsx';
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
        var usedLanguage = SyntaxHighlighting.getLanguageFromFilename(props.filename);

        if (!usedLanguage || props.fileInfo.size > Constants.CODE_PREVIEW_MAX_FILE_SIZE) {
            this.setState({code: '', lang: '', loading: false, success: false});
            return;
        }

        this.setState({code: '', lang: usedLanguage, loading: true});

        $.ajax({
            async: true,
            url: props.fileUrl,
            type: 'GET',
            error: this.handleReceivedError,
            success: this.handleReceivedCode
        });
    }

    handleReceivedCode(data) {
        this.setState({code: data, loading: false, success: true});
    }

    handleReceivedError() {
        this.setState({loading: false, success: false});
    }

    static support(filename) {
        return !!SyntaxHighlighting.getLanguageFromFilename(filename);
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
                    filename={this.props.filename}
                    fileUrl={this.props.fileUrl}
                    fileInfo={this.props.fileInfo}
                    formatMessage={this.props.formatMessage}
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

        const fileName = this.props.filename.substring(this.props.filename.lastIndexOf('/') + 1, this.props.filename.length);

        return (
            <div className='post-code'>
                <span className='post-code__language'>
                    {`${fileName} - ${language}`}
                </span>
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
        );
    }
}

CodePreview.propTypes = {
    filename: React.PropTypes.string.isRequired,
    fileUrl: React.PropTypes.string.isRequired,
    fileInfo: React.PropTypes.object.isRequired,
    formatMessage: React.PropTypes.func.isRequired
};
