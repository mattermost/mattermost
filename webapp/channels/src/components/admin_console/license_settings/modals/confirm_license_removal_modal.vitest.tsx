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

    it('renders the modal title', () => {
        renderWithContext(
            <ConfirmLicenseRemovalModal {...baseProps}/>,
            initialState,
        );

        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    });

    it('calls handleRemove when confirm button is clicked', () => {
        renderWithContext(
            <ConfirmLicenseRemovalModal {...baseProps}/>,
            initialState,
        );

        const confirmButton = screen.getByRole('button', {name: /confirm/i});
        fireEvent.click(confirmButton);

        expect(baseProps.handleRemove).toHaveBeenCalledTimes(1);
    });

    it('calls onExited when cancel button is clicked', () => {
        renderWithContext(
            <ConfirmLicenseRemovalModal {...baseProps}/>,
            initialState,
        );

        const cancelButton = screen.getByRole('button', {name: /cancel/i});
        fireEvent.click(cancelButton);

        expect(baseProps.onExited).toHaveBeenCalledTimes(1);
    });

    it('shows the current SKU in the message', () => {
        renderWithContext(
            <ConfirmLicenseRemovalModal {...baseProps}/>,
            initialState,
        );

        expect(screen.getByText(/Professional/)).toBeInTheDocument();
        expect(screen.getByText(/Free/)).toBeInTheDocument();
    });

    it('does not render modal content when modal is hidden', () => {
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
});
