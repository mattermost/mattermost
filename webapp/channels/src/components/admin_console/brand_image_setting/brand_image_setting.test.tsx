// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {screen, renderWithContext, userEvent, cleanup, waitFor} from 'tests/react_testing_utils';

import BrandImageSetting from './brand_image_setting';

Client4.setUrl('http://localhost:8065');

describe('components/admin_console/brand_image_setting', () => {
    const baseProps = {
        disabled: false,
        setSaveNeeded: jest.fn(),
        registerSaveAction: jest.fn(),
        unRegisterSaveAction: jest.fn(),
    };

    const deleteButtonTestId = 'remove-image__btn';

    /**
     * The previous test directly called 'handleSave' to test the 'deleteBrandImage' and 'uploadBrandImage' functions.
     *
     * This is only possible with a class component and Enzyme, but RTL promotes testing components the way
     * a user would interact with them, hence the updated tests.
     *
     * 'deleteBrandImage' and 'uploadBrandImage' are only accessible in the 'handleSave' method which can't be
     * invoked via any user interactions.
     *
     * Delete this comment after PR review.
     */

    test('should register and unregister save handler when mounted and unmounted respectively', () => {
        renderWithContext(<BrandImageSetting {...baseProps}/>);

        expect(baseProps.registerSaveAction).toHaveBeenCalledTimes(1);

        cleanup();

        expect(baseProps.unRegisterSaveAction).toHaveBeenCalledTimes(1);
    });

    test('should show delete button if brand image exists', async () => {
        /**
         * The casts at the end exists to prevent you from having to provide a value for every property in the
         * 'Promise<Response>' object thus preventing a TypeScript error.
         */
        global.fetch = jest.fn(() => Promise.resolve({status: 200} as Partial<Response> as Response));

        await waitFor(() => renderWithContext(<BrandImageSetting {...baseProps}/>));

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId(deleteButtonTestId)).toBeVisible();
    });

    test('should hide delete button if the setting is disabled', async () => {
        global.fetch = jest.fn(() => Promise.resolve({status: 200} as Partial<Response> as Response));

        const props = {...baseProps, disabled: true};

        await waitFor(() => renderWithContext(<BrandImageSetting {...props}/>));

        expect(screen.queryByTestId(deleteButtonTestId)).toBe(null);
    });

    test('should call setSaveNeeded when a brand image is uploaded', async () => {
        renderWithContext(<BrandImageSetting {...baseProps}/>);

        await userEvent.upload(screen.getByTestId('file__upload-input'), new File(['brand_image_file'], 'brand_image_file.png', {type: 'image/png'}));

        expect(baseProps.setSaveNeeded).toHaveBeenCalledTimes(1);
    });

    test('should call setSaveNeeded when the delete button is pressed', async () => {
        global.fetch = jest.fn(() => Promise.resolve({status: 200} as Partial<Response> as Response));

        await waitFor(() => renderWithContext(<BrandImageSetting {...baseProps}/>));

        await userEvent.click(screen.getByTestId(deleteButtonTestId));

        expect(baseProps.setSaveNeeded).toHaveBeenCalledTimes(1);
    });
});
