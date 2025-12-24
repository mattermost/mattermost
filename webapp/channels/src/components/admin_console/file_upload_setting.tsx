// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, useRef, useState} from 'react';
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

const FileUploadSetting = ({
    id,
    error: errorFromProps,
    label,
    helpText,
    disabled,
    fileType,
    uploadingText,
    onSubmit,
}: Props) => {
    const [fileNameFromState, setFileNameFromState] = useState<string | null>(null);

    const [isUploading, setIsUploading] = useState(false);
    const [isFileSelected, setIsFileSelected] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Helps prevent setting state after component is unmounted, for usage when this component is wrapped by a custom setting
    const isMounted = useRef(false);

    useEffect(() => {
        isMounted.current = true;

        return () => {
            isMounted.current = false;
        };
    }, []);

    const handleChooseClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleChange = useCallback(() => {
        const files = fileInputRef.current?.files;
        if (files && files.length > 0) {
            setIsFileSelected(true);
            setFileNameFromState(files[0].name);
        }
    }, []);

    const handleSubmit = useCallback((e: React.MouseEvent) => {
        e.preventDefault();

        setIsUploading(true);
        const file = fileInputRef.current?.files?.[0];
        if (file) {
            onSubmit(id, file, (error) => {
                if (isMounted.current) {
                    setIsUploading(false);

                    if (error && fileInputRef.current) {
                        Utils.clearFileInput(fileInputRef.current);
                    }
                }
            });
        }
    }, [id, onSubmit]);

    let serverError;
    if (errorFromProps) {
        serverError = (
            <div className='form-group has-error'>
                <label className='control-label'>
                    {errorFromProps}
                </label>
            </div>
        );
    }

    let fileName;
    if (fileNameFromState) {
        fileName = fileNameFromState;
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
            label={label}
            helpText={helpText}
            inputId={id}
        >
            <div>
                <div className='file__upload'>
                    <button
                        type='button'
                        className='btn btn-tertiary'
                        disabled={disabled}
                        onClick={handleChooseClick}
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
                    className='btn btn-primary'
                    disabled={!isFileSelected}
                    onClick={handleSubmit}
                >
                    {
                        isUploading && (
                            <>
                                <span className='glyphicon glyphicon-refresh glyphicon-refresh-animate'/>
                                {uploadingText}
                            </>
                        )
                    }
                    {
                        !isUploading &&
                        <FormattedMessage
                            id='admin.file_upload.uploadFile'
                            defaultMessage='Upload'
                        />
                    }
                </button>
                <div className='help-text m-0'>
                    {fileName}
                </div>
                {serverError}
            </div>
        </Setting>
    );
};

export default memo(FileUploadSetting);
