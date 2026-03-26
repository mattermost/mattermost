// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {uploadBrandImage, deleteBrandImage} from 'actions/admin_actions.jsx';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import BrandImageSetting from './brand_image_setting';

// Real implementations are async (await dispatch(...)); mocks must return Promises so handleSave can await them.
jest.mock('actions/admin_actions.jsx', () => ({
    ...jest.requireActual('actions/admin_actions.jsx'),
    uploadBrandImage: jest.fn(async () => {}),
    deleteBrandImage: jest.fn(async () => {}),
}));

describe('components/admin_console/brand_image_setting', () => {
    beforeEach(() => {
        jest.spyOn(global, 'fetch').mockResolvedValue({status: 404} as Response);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const baseProps = {
        disabled: false,
        setSaveNeeded: jest.fn(),
        registerSaveAction: jest.fn(),
        unRegisterSaveAction: jest.fn(),
    };

    test('should have called deleteBrandImage or uploadBrandImage on save depending on component state', async () => {
        let saveAction: (() => Promise<unknown>) | undefined;
        const registerSaveAction = jest.fn((fn: () => Promise<unknown>) => {
            saveAction = fn;
        });

        const {container, unmount} = renderWithContext(
            <BrandImageSetting
                {...baseProps}
                registerSaveAction={registerSaveAction}
            />,
        );

        // Wait for componentDidMount fetch to resolve
        await waitFor(() => {
            expect(registerSaveAction).toHaveBeenCalled();
        });
        expect(saveAction).toBeDefined();

        // Simulate selecting a file via the file input to set brandImage
        const file = new File(['brand_image_file'], 'brand.png', {type: 'image/png'});
        const fileInput = container.querySelector('input[type="file"]');
        expect(fileInput).toBeInTheDocument();
        await userEvent.upload(fileInput as HTMLInputElement, file);

        // Now call save - should call uploadBrandImage
        await saveAction!();
        expect(deleteBrandImage).toHaveBeenCalledTimes(0);
        expect(uploadBrandImage).toHaveBeenCalledTimes(1);

        // To test deleteBrandImage path, unmount then re-mount with fetch returning 200
        unmount();
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockResolvedValueOnce({status: 200} as Response);

        let saveAction2: (() => Promise<unknown>) | undefined;
        const registerSaveAction2 = jest.fn((fn: () => Promise<unknown>) => {
            saveAction2 = fn;
        });

        renderWithContext(
            <BrandImageSetting
                {...baseProps}
                registerSaveAction={registerSaveAction2}
            />,
        );

        await waitFor(() => {
            expect(registerSaveAction2).toHaveBeenCalled();
        });
        expect(saveAction2).toBeDefined();

        // Wait for the brand image to be detected and delete button to appear
        await waitFor(() => {
            expect(screen.getByText('×')).toBeInTheDocument();
        });
        const deleteButton = screen.getByText('×').closest('button')!;
        await userEvent.click(deleteButton);

        await waitFor(() => {
            expect(screen.getByText('No brand image uploaded')).toBeInTheDocument();
        });

        await saveAction2!();
        expect(deleteBrandImage).toHaveBeenCalledTimes(1);
        expect(uploadBrandImage).toHaveBeenCalledTimes(0);
    });
});
