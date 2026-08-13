// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {General} from 'mattermost-redux/constants';

import * as i18Selectors from 'selectors/i18n';

import {renderWithContext, screen, act, fireEvent} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import UploadLicenseModal from './upload_license_modal';

jest.mock('selectors/i18n');
jest.mock('mattermost-redux/actions/admin', () => ({
    uploadLicense: jest.fn(() => () => Promise.resolve({data: true})),
    previewLicense: jest.fn(() => () => Promise.resolve({data: {
        id: 'preview-id',
        issued_at: 1517714643650,
        starts_at: 1517714643650,
        expires_at: 1620335443650,
        sku_name: 'Enterprise',
        sku_short_name: 'Enterprise',
        features: {},
    }})),
}));
jest.mock('mattermost-redux/actions/general', () => ({
    ...jest.requireActual('mattermost-redux/actions/general'),
    getLicenseConfig: jest.fn(() => () => Promise.resolve({data: true})),
}));

describe('components/admin_console/license_settings/modals/upload_license_modal', () => {
    (i18Selectors.getCurrentLocale as jest.Mock).mockReturnValue(General.DEFAULT_LOCALE);

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // required state to mount using the provider
    const license = {
        IsLicensed: 'true',
        IssuedAt: '1517714643650',
        StartsAt: '1517714643650',
        ExpiresAt: '1620335443650',
        SkuShortName: 'Enterprise',
        Name: 'LicenseName',
        Company: 'Mattermost Inc.',
        Users: '100',
    };

    const state: DeepPartial<GlobalState> = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'false',
                },
            },
            users: {
                currentUserId: '',
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

    const mockOnExited = jest.fn();

    const props = {
        onExited: mockOnExited,
        fileObjFromProps: {name: 'Test license file'} as File,
    };

    test('should match snapshot when is not licensed', async () => {
        let container: HTMLElement;
        await act(async () => {
            ({container} = renderWithContext(
                <UploadLicenseModal {...props}/>,
                state,
            ));
        });
        expect(container!).toMatchSnapshot();
    });

    test('should match snapshot when is licensed', async () => {
        const localState: DeepPartial<GlobalState> = {
            ...state,
            entities: {
                general: {
                    license: {...license},
                },
            },
        };
        let container: HTMLElement;
        await act(async () => {
            ({container} = renderWithContext(
                <UploadLicenseModal {...props}/>,
                localState,
            ));
        });
        expect(container!).toMatchSnapshot();
    });

    test('should not show apply button when no file is selected', () => {
        const newProps = {...props, fileObjFromProps: null};
        renderWithContext(
            <UploadLicenseModal {...newProps}/>,
            state,
        );
        expect(screen.queryByRole('button', {name: 'Apply License'})).not.toBeInTheDocument();
    });

    test('should show apply button enabled after preview when file is loaded', async () => {
        await act(async () => {
            renderWithContext(
                <UploadLicenseModal {...props}/>,
                state,
            );
        });
        const applyButton = screen.getByRole('button', {name: 'Apply License'});
        expect(applyButton).not.toBeDisabled();
    });

    test('should show loading state when no file is loaded', () => {
        const newProps = {...props, fileObjFromProps: null};
        renderWithContext(
            <UploadLicenseModal {...newProps}/>,
            state,
        );
        expect(screen.getByText('Validating License')).toBeInTheDocument();
    });

    test('should show preview step after file is loaded', async () => {
        await act(async () => {
            renderWithContext(
                <UploadLicenseModal {...props}/>,
                state,
            );
        });
        expect(screen.getByText('Review License Changes')).toBeInTheDocument();
    });

    test('should show success state when apply license is clicked', async () => {
        const localState: DeepPartial<GlobalState> = {
            ...state,
            entities: {
                general: {
                    license: {...license},
                },
            },
        };

        await act(async () => {
            renderWithContext(
                <UploadLicenseModal {...props}/>,
                localState,
            );
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Apply License'}));
        });

        expect(screen.getByText('New license successfully applied')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Done'})).toBeInTheDocument();
    });

    test('should format users number', async () => {
        const localState: DeepPartial<GlobalState> = {
            ...state,
            entities: {
                general: {
                    license: {...license, Users: '123456789'},
                },
            },
        };

        await act(async () => {
            renderWithContext(
                <UploadLicenseModal {...props}/>,
                localState,
            );
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Apply License'}));
        });

        expect(screen.getByText(/123,456,789/)).toBeInTheDocument();
    });

    test('should show error state when license validation fails', async () => {
        const previewLicenseMock = jest.requireMock('mattermost-redux/actions/admin').previewLicense;
        previewLicenseMock.mockImplementationOnce(() => () => Promise.resolve({error: {message: 'Invalid license file.'}}));

        await act(async () => {
            renderWithContext(
                <UploadLicenseModal {...props}/>,
                state,
            );
        });

        expect(screen.getByText('License validation failed')).toBeInTheDocument();
        expect(screen.getByText('Invalid license file.')).toBeInTheDocument();
        expect(document.getElementById('close-button')).toBeInTheDocument();
        expect(screen.queryByText('Please wait while we validate your license file...')).not.toBeInTheDocument();
        expect(screen.queryByText('Validating License')).not.toBeInTheDocument();
    });

    test('should hide the upload modal', () => {
        const localState: DeepPartial<GlobalState> = {
            ...state,
            views: {
                modals: {
                    modalState: {},
                },
            },
        };
        renderWithContext(
            <UploadLicenseModal {...props}/>,
            localState,
        );

        expect(screen.queryByText('Validating License')).not.toBeInTheDocument();
    });
});
