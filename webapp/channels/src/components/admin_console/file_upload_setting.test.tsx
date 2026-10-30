// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {act, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import FileUploadSetting from './file_upload_setting';

describe('components/admin_console/FileUploadSetting', () => {
    const file = new File(['content'], 'cert.txt', {type: 'text/plain'});

    const baseProps = {
        id: 'uploadSetting',
        label: 'Upload setting',
        uploadingText: 'Uploading',
        disabled: false,
        fileType: '.txt',
    };

    test('keeps Upload disabled until a file is chosen', async () => {
        const onSubmit = jest.fn();
        renderWithContext(
            <FileUploadSetting
                {...baseProps}
                onSubmit={onSubmit}
            />,
        );

        const uploadButton = screen.getByRole('button', {name: 'Upload'});
        expect(uploadButton).toBeDisabled();

        await userEvent.click(uploadButton);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    test('submits the chosen file and shows it as loading until the upload finishes', async () => {
        const onSubmit = jest.fn();
        const {container} = renderWithContext(
            <FileUploadSetting
                {...baseProps}
                onSubmit={onSubmit}
            />,
        );

        await userEvent.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
        await userEvent.click(screen.getByRole('button', {name: 'Upload'}));

        expect(onSubmit).toHaveBeenCalledWith('uploadSetting', file, expect.any(Function));
        expect(screen.getByRole('button', {name: 'Uploading'})).toBeDisabled();

        act(() => {
            onSubmit.mock.calls[0][2]();
        });

        expect(screen.getByRole('button', {name: 'Upload'})).toBeEnabled();
        expect(screen.getByText('cert.txt')).toBeInTheDocument();
    });

    test('clears the selection after a failed upload so the button is not left loading', async () => {
        const onSubmit = jest.fn();
        const {container} = renderWithContext(
            <FileUploadSetting
                {...baseProps}
                onSubmit={onSubmit}
            />,
        );

        await userEvent.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
        await userEvent.click(screen.getByRole('button', {name: 'Upload'}));

        act(() => {
            onSubmit.mock.calls[0][2]('upload failed');
        });

        const uploadButton = screen.getByRole('button', {name: 'Upload'});
        expect(uploadButton).toBeDisabled();
        expect(uploadButton).not.toHaveAttribute('aria-busy');
        expect(screen.queryByText('cert.txt')).not.toBeInTheDocument();
        expect(screen.getByText('No file uploaded')).toBeInTheDocument();
    });
});
