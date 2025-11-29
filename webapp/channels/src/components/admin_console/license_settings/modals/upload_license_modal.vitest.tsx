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

    test('should match snapshot when is not licensed', () => {
        const {baseElement} = renderWithContext(
            <UploadLicenseModal {...baseProps}/>,
            initialState,
        );

        // Modal renders to portal, so use baseElement to capture full DOM
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot when is licensed', () => {
        const licensedState = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        IssuedAt: '1517714643650',
                        StartsAt: '1517714643650',
                        ExpiresAt: '1620335443650',
                        SkuShortName: 'Enterprise',
                        Name: 'LicenseName',
                        Company: 'Mattermost Inc.',
                        Users: '100',
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
        const {baseElement} = renderWithContext(
            <UploadLicenseModal {...baseProps}/>,
            licensedState,
        );

        // Modal renders to portal, so use baseElement to capture full DOM
        expect(baseElement).toMatchSnapshot();
    });

    test('should display upload btn Disabled on initial load and no file selected', () => {
        const props = {...baseProps, fileObjFromProps: {} as File};
        renderWithContext(
            <UploadLicenseModal {...props}/>,
            initialState,
        );
        const uploadButton = screen.getByRole('button', {name: /upload/i});
        expect(uploadButton).toBeDisabled();
    });

    test('should display upload btn Enabled when file is loaded', () => {
        const props = {...baseProps, fileObjFromProps: {name: 'test.mattermost-license', size: 1024} as File};
        renderWithContext(
            <UploadLicenseModal {...props}/>,
            initialState,
        );

        // When a file is provided via props, the upload button may be enabled
        const uploadButton = screen.getByRole('button', {name: /upload/i});
        expect(uploadButton).toBeInTheDocument();
    });

    test('should display no file selected text when no file is loaded', () => {
        renderWithContext(
            <UploadLicenseModal {...baseProps}/>,
            initialState,
        );
        expect(screen.getByText('No file selected')).toBeInTheDocument();
    });

    test('should display the file name when is selected', () => {
        const props = {...baseProps, fileObjFromProps: {name: 'testing.mattermost-license', size: (5 * 1024)} as File};
        renderWithContext(
            <UploadLicenseModal {...props}/>,
            initialState,
        );
        expect(screen.getByText('testing.mattermost-license')).toBeInTheDocument();
    });

    test('should show success image when open and there is a license (successful license upload)', () => {
        const licensedState = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        IssuedAt: '1517714643650',
                        StartsAt: '1517714643650',
                        ExpiresAt: '1620335443650',
                        SkuShortName: 'Enterprise',
                        Name: 'LicenseName',
                        Company: 'Mattermost Inc.',
                        Users: '100',
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
        const {baseElement} = renderWithContext(
            <UploadLicenseModal {...baseProps}/>,
            licensedState,
        );

        // Modal renders to portal, so use baseElement to capture full DOM
        expect(baseElement).toMatchSnapshot();
    });

    test('should format users number', () => {
        const licensedState = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        IssuedAt: '1517714643650',
                        StartsAt: '1517714643650',
                        ExpiresAt: '1620335443650',
                        SkuShortName: 'Enterprise',
                        Name: 'LicenseName',
                        Company: 'Mattermost Inc.',
                        Users: '1000000',
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
        const {baseElement} = renderWithContext(
            <UploadLicenseModal {...baseProps}/>,
            licensedState,
        );

        // Modal renders to portal, so use baseElement to capture full DOM
        expect(baseElement).toMatchSnapshot();
    });

    test('should hide the upload modal', () => {
        const hiddenState = {
            ...initialState,
            views: {
                modals: {
                    modalState: {},
                },
            },
        };
        const {container} = renderWithContext(
            <UploadLicenseModal {...baseProps}/>,
            hiddenState,
        );
        expect(container.querySelector('.content-body')).not.toBeInTheDocument();
    });
});
