// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';
import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, userEvent, waitFor} from 'tests/react_testing_utils';

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

    let scope: nock.Scope;

    beforeAll(() => {
        scope = nock(Client4.getBaseRoute()).persist().get('/brand/image').query(true).reply(200);
    });

    afterAll(() => {
        nock.cleanAll();
    });

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
        const {unmount} = renderWithContext(<BrandImageSetting {...baseProps}/>);

        expect(baseProps.registerSaveAction).toHaveBeenCalledTimes(1);

        unmount();

        expect(baseProps.unRegisterSaveAction).toHaveBeenCalledTimes(1);
    });

    test('should show delete button if brand image exists', async () => {
        const {getByTestId} = renderWithContext(<BrandImageSetting {...baseProps}/>);

        await waitFor(() => expect(scope.isDone()).toBe(true));

        expect(getByTestId(deleteButtonTestId)).toBeVisible();
    });

    test('should hide delete button if the setting is disabled', async () => {
        const props = {...baseProps, disabled: true};

        const {queryByTestId} = renderWithContext(<BrandImageSetting {...props}/>);

        await waitFor(() => expect(queryByTestId(deleteButtonTestId)).toBe(null));
    });

    test('should call setSaveNeeded when a brand image is uploaded', async () => {
        const {getByTestId} = renderWithContext(<BrandImageSetting {...baseProps}/>);

        await userEvent.upload(getByTestId('file__upload-input'), new File(['brand_image_file'], 'brand_image_file.png', {type: 'image/png'}));

        expect(baseProps.setSaveNeeded).toHaveBeenCalledTimes(1);
    });

    test('should call setSaveNeeded when the delete button is pressed', async () => {
        const {findByTestId} = renderWithContext(<BrandImageSetting {...baseProps}/>);

        const deleteButton = await findByTestId(deleteButtonTestId);

        await userEvent.click(deleteButton);

        expect(baseProps.setSaveNeeded).toHaveBeenCalledTimes(1);
    });
});
