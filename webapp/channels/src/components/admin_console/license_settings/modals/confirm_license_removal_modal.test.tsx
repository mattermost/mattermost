// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import ConfirmLicenseRemovalModal from './confirm_license_removal_modal';

describe('components/admin_console/license_settings/modals/confirm_license_removal_modal', () => {
    // required state to mount using the provider
    const state: DeepPartial<GlobalState> = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                },
            },
        },
        views: {
            modals: {
                modalState: {
                    confirm_license_removal: {
                        open: true,
                    },
                },
            },
        },
    };

    const mockHandleRemove = jest.fn();
    const mockOnExited = jest.fn();

    const props = {
        currentLicenseSKU: 'Professional',
        onExited: mockOnExited,
        handleRemove: mockHandleRemove,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <ConfirmLicenseRemovalModal {...props}/>,
            state,
        );
        expect(container).toMatchSnapshot();
    });

    test('should call the removal method when confirm button is clicked', () => {
        renderWithContext(
            <ConfirmLicenseRemovalModal {...props}/>,
            state,
        );
        const confirmButton = screen.getByRole('button', {name: 'Confirm'});
        confirmButton.click();
        expect(mockHandleRemove).toHaveBeenCalledTimes(1);
    });

    test('should close the modal when cancel button is clicked', () => {
        renderWithContext(
            <ConfirmLicenseRemovalModal {...props}/>,
            state,
        );
        const cancelButton = screen.getByRole('button', {name: 'Cancel'});
        cancelButton.click();
        expect(mockOnExited).toHaveBeenCalledTimes(1);
    });

    test('should hide the confirm modal', () => {
        const localState: DeepPartial<GlobalState> = {
            ...state,
            views: {
                modals: {
                    modalState: {},
                },
            },
        };
        renderWithContext(
            <ConfirmLicenseRemovalModal {...props}/>,
            localState,
        );
        expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
    });

    test('should show which SKU is currently being removed in confirmation message', () => {
        renderWithContext(
            <ConfirmLicenseRemovalModal {...props}/>,
            state,
        );

        expect(screen.getByText(/Removing the license will downgrade your server from Professional to Free/)).toBeInTheDocument();
    });
});
