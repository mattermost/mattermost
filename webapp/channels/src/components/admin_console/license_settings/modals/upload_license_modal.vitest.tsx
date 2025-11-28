// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import UploadLicenseModal from './upload_license_modal';

describe('components/admin_console/license_settings/modals/upload_license_modal', () => {
    const initialState = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'false',
                },
            },
        },
        views: {
            modals: {
                modalState: {
                    upload_license: {
                        open: true,
                    },
                },
            },
        },
    };

    const baseProps = {
        onExited: vi.fn(),
        fileObjFromProps: {name: 'Test license file'} as File,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the modal title', () => {
        renderWithContext(
            <UploadLicenseModal {...baseProps}/>,
            initialState,
        );

        expect(screen.getByText('Upload a License Key')).toBeInTheDocument();
    });

    it('renders the upload button', () => {
        renderWithContext(
            <UploadLicenseModal {...baseProps}/>,
            initialState,
        );

        expect(screen.getByRole('button', {name: /upload/i})).toBeInTheDocument();
    });

    it('renders file selection area', () => {
        renderWithContext(
            <UploadLicenseModal {...baseProps}/>,
            initialState,
        );

        // Should show "No file selected" initially
        expect(screen.getByText('No file selected')).toBeInTheDocument();
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
            <UploadLicenseModal {...baseProps}/>,
            hiddenModalState,
        );

        expect(screen.queryByText('Upload a License Key')).not.toBeInTheDocument();
    });
});
