// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import * as Utils from 'utils/utils';

import Setting from './setting';

type Props = {
    id: string;
    label: React.ReactNode;
    helpText?: React.ReactNode;
    uploadingText?: React.ReactNode;
    onSubmit: (id: string, file: File, errorCallback: (error?: string) => void) => void;
    disabled: boolean;
    fileType: string;
    error?: string;
}

type State = {
    fileName: null|string;
    fileSelected: boolean;
    serverError?: string;
    uploading: boolean;
}

export default class FileUploadSetting extends React.PureComponent<Props, State> {
    fileInputRef = React.createRef<HTMLInputElement>();

    constructor(props: Props) {
        super(props);

        this.state = {
            fileName: null,
            serverError: props.error,
            uploading: false,
            fileSelected: false,
        };
    }

    handleChange = () => {
        const files = this.fileInputRef.current?.files;
        if (files && files.length > 0) {
            this.setState({fileSelected: true, fileName: files[0].name});
        }
    };

    handleSubmit = (e: React.MouseEvent) => {
        e.preventDefault();

        this.setState({uploading: true});
        const file = this.fileInputRef.current?.files?.[0];
        if (file) {
            this.props.onSubmit(this.props.id, file, (error) => {
                this.setState({uploading: false});
                if (error && this.fileInputRef.current) {
                    Utils.clearFileInput(this.fileInputRef.current);
                }
            });
        }
    };

    render() {
        let serverError;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
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
                            className='btn btn-tertiary'
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
                        className='btn btn-primary'
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
