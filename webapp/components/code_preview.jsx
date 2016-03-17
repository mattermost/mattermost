// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import * as syntaxHightlighting from 'utils/syntax_hightlighting.jsx';
import Constants from 'utils/constants.jsx';
import FileInfoPreview from './file_info_preview.jsx';

import React from 'react';

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
        var usedLanguage = syntaxHightlighting.getLang(props.filename);

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
        const parsed = syntaxHightlighting.formatCode(this.state.lang, data, this.props.filename);
        this.setState({code: parsed, loading: false, success: true});
    }

    handleReceivedError() {
        this.setState({loading: false, success: false});
    }

    static support(filename) {
        return typeof syntaxHightlighting.getLang(filename) !== 'undefined';
    }

    render() {
        if (this.state.loading) {
            return (
                <div className='view-image__loading'>
                    <img
                        className='loader-image'
                        src='/static/images/load.gif'
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

        return <div dangerouslySetInnerHTML={{__html: this.state.code}}/>;
    }
}

CodePreview.propTypes = {
    filename: React.PropTypes.string.isRequired,
    fileUrl: React.PropTypes.string.isRequired,
    fileInfo: React.PropTypes.object.isRequired,
    formatMessage: React.PropTypes.func.isRequired
};
