// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import ConfirmLicenseRemovalModal from './confirm_license_removal_modal';

describe('components/admin_console/license_settings/modals/confirm_license_removal_modal', () => {
    const initialState = {
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

    const baseProps = {
        currentLicenseSKU: 'Professional',
        onExited: vi.fn(),
        handleRemove: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should match snapshot', () => {
        const {baseElement} = renderWithContext(
            <ConfirmLicenseRemovalModal {...baseProps}/>,
            initialState,
        );

        // Modal renders to portal, so use baseElement to capture full DOM
        expect(baseElement).toMatchSnapshot();
    });

    test('should call the removal method when confirm button is clicked', () => {
        renderWithContext(
            <ConfirmLicenseRemovalModal {...baseProps}/>,
            initialState,
        );

        const confirmButton = screen.getByRole('button', {name: /confirm/i});
        fireEvent.click(confirmButton);

        expect(baseProps.handleRemove).toHaveBeenCalledTimes(1);
    });

    test('should close the modal when cancel button is clicked', () => {
        renderWithContext(
            <ConfirmLicenseRemovalModal {...baseProps}/>,
            initialState,
        );

        const cancelButton = screen.getByRole('button', {name: /cancel/i});
        fireEvent.click(cancelButton);

        expect(baseProps.onExited).toHaveBeenCalledTimes(1);
    });

    test('should hide the confirm modal', () => {
        const hiddenModalState = {
            ...initialState,
            views: {
                modals: {
                    modalState: {},
                },
            },
        };

        renderWithContext(
            <ConfirmLicenseRemovalModal {...baseProps}/>,
            hiddenModalState,
        );

        expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
    });

    test('should show which SKU is currently being removed in confirmation message', () => {
        renderWithContext(
            <ConfirmLicenseRemovalModal {...baseProps}/>,
            initialState,
        );

        expect(screen.getByText(/Professional/)).toBeInTheDocument();
        expect(screen.getByText(/Free/)).toBeInTheDocument();
    });
});
