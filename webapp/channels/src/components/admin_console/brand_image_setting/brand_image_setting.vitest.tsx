// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {uploadBrandImage, deleteBrandImage} from 'actions/admin_actions.jsx';

import {renderWithContext, cleanup, waitFor, act, fireEvent} from 'tests/vitest_react_testing_utils';

import BrandImageSetting from './brand_image_setting';

vi.mock('actions/admin_actions.jsx', () => ({
    uploadBrandImage: vi.fn(),
    deleteBrandImage: vi.fn(),
}));

Client4.setUrl('http://localhost:8065');

describe('components/admin_console/brand_image_setting', () => {
    const baseProps = {
        disabled: false,
        setSaveNeeded: vi.fn(),
        registerSaveAction: vi.fn(),
        unRegisterSaveAction: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    test('should have called deleteBrandImage or uploadBrandImage on save depending on component state', async () => {
        // Test 1: Upload scenario - Select a file and trigger save
        // Mock fetch for brand image check - return 404 (no brand image exists)
        global.fetch = vi.fn().mockResolvedValue({
            status: 404,
        });

        // Create a mock for registerSaveAction that captures the handleSave function
        let capturedSaveAction: (() => Promise<unknown>) | null = null;
        const registerSaveAction = vi.fn((saveAction: () => Promise<unknown>) => {
            capturedSaveAction = saveAction;
        });

        const props = {
            ...baseProps,
            registerSaveAction,
        };

        renderWithContext(<BrandImageSetting {...props}/>);

        // Wait for component to mount and register save action
        await waitFor(() => {
            expect(registerSaveAction).toHaveBeenCalled();
        });

        // Ensure we captured the save action
        expect(capturedSaveAction).not.toBeNull();

        // Select a file
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        expect(fileInput).toBeInTheDocument();

        const file = new File(['brand_image_file'], 'brand.png', {type: 'image/png'});
        Object.defineProperty(fileInput, 'files', {
            value: [file],
            configurable: true,
        });

        await act(async () => {
            fireEvent.change(fileInput);
        });

        // Call the captured save action (simulating save button click)
        // When brandImage is set (file selected), uploadBrandImage should be called
        await act(async () => {
            await capturedSaveAction!();
        });

        expect(deleteBrandImage).toHaveBeenCalledTimes(0);
        expect(uploadBrandImage).toHaveBeenCalledTimes(1);

        // Clean up first render
        cleanup();

        // Test 2: Delete scenario - Brand image exists, click delete, then save
        vi.mocked(uploadBrandImage).mockClear();
        vi.mocked(deleteBrandImage).mockClear();

        // Mock fetch to return 200 (brand image exists)
        global.fetch = vi.fn().mockResolvedValue({
            status: 200,
        });

        // Create new captured save action for second render
        let capturedSaveAction2: (() => Promise<unknown>) | null = null;
        const registerSaveAction2 = vi.fn((saveAction: () => Promise<unknown>) => {
            capturedSaveAction2 = saveAction;
        });

        const props2 = {
            ...baseProps,
            registerSaveAction: registerSaveAction2,
        };

        renderWithContext(<BrandImageSetting {...props2}/>);

        // Wait for component to register save action
        await waitFor(() => {
            expect(registerSaveAction2).toHaveBeenCalled();
        });

        // Wait for brand image to be detected (fetch returns 200)
        await waitFor(() => {
            const deleteButton = document.querySelector('.remove-image__btn') as HTMLButtonElement;
            expect(deleteButton).toBeInTheDocument();
        });

        // Find and click the delete button
        const deleteButton = document.querySelector('.remove-image__btn') as HTMLButtonElement;
        await act(async () => {
            fireEvent.click(deleteButton);
        });

        // Call save action after delete button was clicked
        // When deleteBrandImage state is true, deleteBrandImage should be called
        await act(async () => {
            await capturedSaveAction2!();
        });

        expect(deleteBrandImage).toHaveBeenCalledTimes(1);
        expect(uploadBrandImage).toHaveBeenCalledTimes(0);
    });
});
