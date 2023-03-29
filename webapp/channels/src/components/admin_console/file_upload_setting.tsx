// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, createRef} from 'react';
import {FormattedMessage} from 'react-intl';

import * as Utils from 'utils/utils';

import Setting from './setting';

type Props = {
    id: string;
    label: React.ReactNode;
    helpText?: React.ReactNode;
    uploadingText?: React.ReactNode;
    onSubmit: (id: string, file: File, func: (error: Error) => void) => void;
    disabled?: boolean;
    fileType: string;
    error?: string;
};

const FileUploadSetting = ({
    id,
    label,
    helpText,
    uploadingText,
    onSubmit,
    disabled = false,
    fileType,
    error,
}: Props) => {
    const fileInputRef = createRef<HTMLInputElement>();
    const [fileName, setFileName] = useState('');
    const [fileSelected, setFileSelected] = useState(false);
    const [uploading, setUploading] = useState(false);

    const getFilesFromRef = () => {
        if (!fileInputRef.current) {
            return null;
        }
        return fileInputRef.current.files;
    };
    const handleChange = () => {
        const files = getFilesFromRef();
        if (files && files.length > 0) {
            setFileName(files[0].name);
            setFileSelected(true);
        }
    };

    const handleSubmit = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();

        const files = getFilesFromRef();
        if (!files || files.length === 0) {
            return;
        }
        setUploading(true);
        onSubmit(id, files[0], (error) => {
            setUploading(false);
            if (error && fileInputRef?.current) {
                Utils.clearFileInput(fileInputRef.current);
            }
        });
    };

    return (
        <Setting
            label={label}
            helpText={helpText}
            inputId={id}
        >
            <div>
                <div className='file__upload'>
                    <button
                        type='button'
                        className='btn btn-default'
                        disabled={disabled}
                    >
                        <FormattedMessage
                            id='admin.file_upload.chooseFile'
                            defaultMessage='Choose File'
                        />
                    </button>
                    <input
                        ref={fileInputRef}
                        type='file'
                        disabled={disabled}
                        accept={fileType}
                        onChange={handleChange}
                    />
                </div>
                <button
                    type='button'
                    className={'btn' + (fileSelected ? ' btn-primary' : '')}
                    disabled={!fileSelected}
                    onClick={handleSubmit}
                >
                    {uploading && (
                        <>
                            <span className='glyphicon glyphicon-refresh glyphicon-refresh-animate'/>
                            {uploadingText}
                        </>)}
                    {!uploading &&
                    <FormattedMessage
                        id='admin.file_upload.uploadFile'
                        defaultMessage='Upload'
                    />}
                </button>
                <div className='help-text m-0'>
                    {
                        fileName || (
                            <FormattedMessage
                                id='admin.file_upload.noFile'
                                defaultMessage='No file uploaded'
                            />
                        )
                    }
                </div>
                {error ? (
                    <div className='form-group has-error'>
                        <label className='control-label'>
                            {error}
                        </label>
                    </div>
                ) : null}
            </div>
        </Setting>
    );
};

export default FileUploadSetting;
