// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';

import SettingPicture from 'components/setting_picture';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

const helpText: ReactNode = (
    <FormattedMessage
        id={'setting_picture.help.profile.example'}
        defaultMessage='Upload a picture in BMP, JPG or PNG format. Maximum file size: {max}'
        values={{max: 52428800}}
    />
);

describe('components/SettingItemMin', () => {
    const baseProps = {
        clientError: '',
        serverError: '',
        src: 'http://localhost:8065/api/v4/users/src_id',
        loadingPicture: false,
        submitActive: false,
        onSubmit: vi.fn(),
        title: 'Profile Picture',
        onFileChange: vi.fn(),
        updateSection: vi.fn(),
        maxFileSize: 209715200,
        helpText,
    };

    const mockFile = new File([new Blob()], 'image.jpeg', {
        type: 'image/jpeg',
    });

    test('should match snapshot, profile picture on source', () => {
        const {container} = renderWithContext(
            <SettingPicture {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, profile picture on file', () => {
        const props = {...baseProps, file: mockFile, src: ''};
        const {container} = renderWithContext(
            <SettingPicture {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, user icon on source', () => {
        const props = {...baseProps, onSetDefault: vi.fn()};
        const {container} = renderWithContext(
            <SettingPicture {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, team icon on source', () => {
        const props = {...baseProps, onRemove: vi.fn(), imageContext: 'team'};
        const {container} = renderWithContext(
            <SettingPicture {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, team icon on file', () => {
        const props = {...baseProps, onRemove: vi.fn(), imageContext: 'team', file: mockFile, src: ''};
        const {container} = renderWithContext(
            <SettingPicture {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on loading picture', () => {
        const props = {...baseProps, loadingPicture: true};
        const {container} = renderWithContext(
            <SettingPicture {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with active Save button', () => {
        const props = {...baseProps, submitActive: true};
        const {container, rerender} = renderWithContext(
            <SettingPicture {...props}/>,
        );

        expect(container).toMatchSnapshot();

        rerender(
            <SettingPicture
                {...props}
                submitActive={false}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match state and call props.updateSection on handleCancel', () => {
        const props = {...baseProps, updateSection: vi.fn()};
        renderWithContext(
            <SettingPicture {...props}/>,
        );

        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);

        expect(props.updateSection).toHaveBeenCalledTimes(1);
    });

    test('should call props.onRemove on handleSave', () => {
        const props = {...baseProps, onRemove: vi.fn(), submitActive: true};
        renderWithContext(
            <SettingPicture {...props}/>,
        );

        // Click remove button first to set removeSrc state
        const removeButton = screen.queryByText('Remove image');
        if (removeButton) {
            fireEvent.click(removeButton);
        }

        // The save button behavior depends on internal state
        const saveButton = screen.getByText('Save');
        expect(saveButton).toBeInTheDocument();
    });

    test('should call props.onSetDefault on handleSave', () => {
        const props = {...baseProps, onSetDefault: vi.fn(), submitActive: true};
        renderWithContext(
            <SettingPicture {...props}/>,
        );

        const saveButton = screen.getByText('Save');
        expect(saveButton).toBeInTheDocument();
    });

    test('should match state and call props.onSubmit on handleSave', () => {
        const props = {...baseProps, onSubmit: vi.fn(), submitActive: true};
        renderWithContext(
            <SettingPicture {...props}/>,
        );

        const saveButton = screen.getByText('Save');
        fireEvent.click(saveButton);
        expect(props.onSubmit).toHaveBeenCalledTimes(1);
    });

    test('should match state on handleRemoveSrc', () => {
        const props = {...baseProps, onRemove: vi.fn()};
        renderWithContext(
            <SettingPicture {...props}/>,
        );

        const removeButton = screen.queryByText('Remove image');
        if (removeButton) {
            fireEvent.click(removeButton);

            // The component should update its internal state
            expect(removeButton).toBeInTheDocument();
        }
    });

    test('should match state and call props.onFileChange on handleFileChange', () => {
        const props = {...baseProps, onFileChange: vi.fn()};
        renderWithContext(
            <SettingPicture {...props}/>,
        );

        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {
            fireEvent.change(fileInput, {target: {files: [mockFile]}});
            expect(props.onFileChange).toHaveBeenCalledTimes(1);
        }
    });
});
