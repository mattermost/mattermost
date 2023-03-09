// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import * as Utils from 'utils/utils';

import Setting from './setting';

export default class FileUploadSetting extends Setting {
    static get propTypes() {
        return {
            id: PropTypes.string.isRequired,
            label: PropTypes.node.isRequired,
            helpText: PropTypes.node,
            uploadingText: PropTypes.node,
            onSubmit: PropTypes.func.isRequired,
            disabled: PropTypes.bool,
            fileType: PropTypes.string.isRequired,
            error: PropTypes.string,
        };
    }

    constructor(props) {
        super(props);

        this.state = {
            fileName: null,
            serverError: props.error,
            uploading: false,
        };
        this.fileInputRef = React.createRef();
    }

    handleChange = () => {
        const files = this.fileInputRef.current.files;
        if (files && files.length > 0) {
            this.setState({fileSelected: true, fileName: files[0].name});
        }
    }

    handleSubmit = (e) => {
        e.preventDefault();

        this.setState({uploading: true});
        this.props.onSubmit(this.props.id, this.fileInputRef.current.files[0], (error) => {
            this.setState({uploading: false});
            if (error) {
                Utils.clearFileInput(this.fileInputRef.current);
            }
        });
    }

    render() {
        let serverError;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        let btnClass = 'btn';
        if (this.state.fileSelected) {
            btnClass = 'btn btn-primary';
        }

        let fileName;
        if (this.state.fileName) {
            fileName = this.state.fileName;
        } else {
            fileName = (
                <FormattedMessage
                    id='admin.file_upload.noFile'
                    defaultMessage='No file uploaded'
                />
            );
        }

        return (
            <Setting
                label={this.props.label}
                helpText={this.props.helpText}
                inputId={this.props.id}
            >
                <div>
                    <div className='file__upload'>
                        <button
                            type='button'
                            className='btn btn-default'
                            disabled={this.props.disabled}
                        >
                            <FormattedMessage
                                id='admin.file_upload.chooseFile'
                                defaultMessage='Choose File'
                            />
                        </button>
                        <input
                            ref={this.fileInputRef}
                            type='file'
                            disabled={this.props.disabled}
                            accept={this.props.fileType}
                            onChange={this.handleChange}
                        />
                    </div>
                    <button
                        type='button'
                        className={btnClass}
                        disabled={!this.state.fileSelected}
                        onClick={this.handleSubmit}
                    >
                        {this.state.uploading && (
                            <>
                                <span className='glyphicon glyphicon-refresh glyphicon-refresh-animate'/>
                                {this.props.uploadingText}
                            </>)}
                        {!this.state.uploading &&
                            <FormattedMessage
                                id='admin.file_upload.uploadFile'
                                defaultMessage='Upload'
                            />}
                    </button>
                    <div className='help-text m-0'>
                        {fileName}
                    </div>
                    {serverError}
                </div>
            </Setting>
        );
    }
}
