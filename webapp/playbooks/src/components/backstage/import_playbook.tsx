// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import {useIntl} from 'react-intl';

import {importFile} from 'src/client';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';

type FileData = string | ArrayBuffer | null | undefined;

// 5MB in bytes
const fileSizeLimit = 5242880;

export const useImportPlaybook = (teamId: string, cb: (id: string) => void) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;

    const genericErrorHandler = () => addToast({
        content: formatMessage({defaultMessage: 'The playbook import has failed. Please check that JSON is valid and try again.'}),
        toastStyle: ToastStyle.Failure,
    });

    const readFile = (file: File) => new Promise<FileData>((resolve, reject) => {
        if (file.size > fileSizeLimit) {
            addToast({
                content: formatMessage({defaultMessage: 'The file size exceeds the limit of 5MB.'}),
                toastStyle: ToastStyle.Failure,
            });
            reject(new Error('File size limit exceeded'));
            return;
        }
        if (file.type !== 'application/json') {
            addToast({
                content: formatMessage({defaultMessage: 'The file must be a valid JSON playbook template.'}),
                toastStyle: ToastStyle.Failure,
            });
            reject(new Error('File must be a JSON file'));
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            return resolve(e.target?.result);
        };
        reader.onerror = genericErrorHandler;
        reader.readAsArrayBuffer(file);
    });

    const uploadFile = (data: FileData) => {
        importFile(data, teamId)
            .then(({id}) => cb(id))
            .catch(genericErrorHandler);
    };

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) {
            return;
        }
        if (e.target.files.length > 1) {
            addToast({
                content: formatMessage({defaultMessage: 'Can not import multiple files at once.'}),
                toastStyle: ToastStyle.Failure,
            });
            return;
        }
        readFile(e.target.files[0])
            .then((data) => {
                uploadFile(data);
                e.target.value = '';
            });
    };

    const importPlaybookFile = (file: File) => {
        readFile(file)
            .then(uploadFile);
    };

    const input = (
        <input
            data-testid='playbook-import-input'
            type='file'
            accept='*.json,application/JSON'
            onChange={onChange}
            ref={fileInputRef}
            style={{display: 'none'}}
        />
    );
    return [fileInputRef, input, importPlaybookFile] as const;
};
