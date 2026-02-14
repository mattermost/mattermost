// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import * as reactRedux from 'react-redux';

import {General} from 'mattermost-redux/constants';

import * as i18Selectors from 'selectors/i18n';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {act} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';

import UploadLicenseModal from './upload_license_modal';

jest.mock('selectors/i18n');

describe('components/admin_console/license_settings/modals/upload_license_modal', () => {
    (i18Selectors.getCurrentLocale as jest.Mock).mockReturnValue(General.DEFAULT_LOCALE);

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

    const state = {
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

    const store = mockStore(state);

    test('should match snapshot when is not licensed', () => {
        const wrapper = shallow(
            <reactRedux.Provider store={store}>
                <UploadLicenseModal {...props}/>
            </reactRedux.Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when is licensed', () => {
        const licensedState = {
            general: {
                license: {...license},
            },
            users: {
                currentUserId: '',
            },
        };
        const localStore = {...state, entities: licensedState};
        const store = mockStore(localStore);
        const wrapper = shallow(
            <reactRedux.Provider store={store}>
                <UploadLicenseModal {...props}/>
            </reactRedux.Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should show loading state initially when file is provided', () => {
        const useDispatchMock = jest.spyOn(reactRedux, 'useDispatch');
        const dummyDispatch = jest.fn().mockImplementation(() => new Promise(() => {
            // Never resolve to keep it in loading state
        }));
        useDispatchMock.mockReturnValue(dummyDispatch);

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <UploadLicenseModal {...props}/>
            </reactRedux.Provider>,
        );

        // Should show loading content
        expect(wrapper.find('UploadLicenseModal').find('.content-body').exists()).toBe(true);
        expect(wrapper.find('UploadLicenseModal').find('.title').text()).toContain('Validating License');

        useDispatchMock.mockClear();
    });

    test('should show error and close button when preview fails', async () => {
        const useDispatchMock = jest.spyOn(reactRedux, 'useDispatch');
        const dummyDispatch = jest.fn().mockImplementation(() => Promise.resolve({
            error: {message: 'Invalid license file'},
        }));
        useDispatchMock.mockReturnValue(dummyDispatch);

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <UploadLicenseModal {...props}/>
            </reactRedux.Provider>,
        );

        await act(async () => {
            // Wait for the useEffect to complete
        });

        wrapper.update();

        // Should show error message and close button
        expect(wrapper.find('UploadLicenseModal').find('.serverError').exists()).toBe(true);
        expect(wrapper.find('UploadLicenseModal').find('#close-button').exists()).toBe(true);

        useDispatchMock.mockClear();
    });

    test('should show preview step after successful license preview', async () => {
        const useDispatchMock = jest.spyOn(reactRedux, 'useDispatch');
        const mockLicenseData = {
            id: 'license_id',
            issued_at: 1517714643650,
            starts_at: 1517714643650,
            expires_at: 1620335443650,
            sku_name: 'Enterprise',
            sku_short_name: 'enterprise',
            customer: {
                id: 'customer_id',
                name: 'Test User',
                email: 'test@example.com',
                company: 'Test Company',
            },
            features: {
                users: 100,
            },
        };
        const dummyDispatch = jest.fn().mockImplementation(() => Promise.resolve({
            data: mockLicenseData,
        }));
        useDispatchMock.mockReturnValue(dummyDispatch);

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <UploadLicenseModal {...props}/>
            </reactRedux.Provider>,
        );

        await act(async () => {
            // Wait for the useEffect to complete
        });

        wrapper.update();

        // Should show preview content with cancel and confirm buttons
        expect(wrapper.find('UploadLicenseModal').find('.title').text()).toContain('Review License Changes');
        expect(wrapper.find('UploadLicenseModal').find('#cancel-button').exists()).toBe(true);
        expect(wrapper.find('UploadLicenseModal').find('#confirm-button').exists()).toBe(true);

        useDispatchMock.mockClear();
    });

    test('should show success image when license upload succeeds', async () => {
        const licensedState = {
            general: {
                license: {...license},
            },
            users: {
                currentUserId: '',
            },
        };
        const localStore = {...state, entities: licensedState};
        const store = mockStore(localStore);

        const useDispatchMock = jest.spyOn(reactRedux, 'useDispatch');

        const mockLicenseData = {
            id: 'license_id',
            issued_at: 1517714643650,
            starts_at: 1517714643650,
            expires_at: 1620335443650,
            sku_name: 'Enterprise',
            sku_short_name: 'enterprise',
            customer: {
                id: 'customer_id',
                name: 'Test User',
                email: 'test@example.com',
                company: 'Test Company',
            },
            features: {
                users: 100,
            },
        };

        let callCount = 0;
        const dummyDispatch = jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // First call is previewLicense
                return Promise.resolve({data: mockLicenseData});
            }

            // Subsequent calls (uploadLicense, getLicenseConfig)
            return Promise.resolve({data: {}});
        });
        useDispatchMock.mockReturnValue(dummyDispatch);

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <UploadLicenseModal {...props}/>
            </reactRedux.Provider>,
        );

        // Wait for preview to complete
        await act(async () => {});
        wrapper.update();

        // Click confirm button to upload
        await act(async () => {
            wrapper.find('UploadLicenseModal').find('#confirm-button').simulate('click');
        });

        wrapper.update();

        // Should show success state
        expect(wrapper.find('UploadLicenseModal').find('.hands-svg')).toHaveLength(1);
        expect(wrapper.find('UploadLicenseModal').find('#done-button')).toHaveLength(1);

        useDispatchMock.mockClear();
    });

    test('should format users number in success message', async () => {
        const licensedState = {
            general: {
                license: {...license, Users: '123456789'},
            },
            users: {
                currentUserId: '',
            },
        };
        const localStore = {...state, entities: licensedState};
        const store = mockStore(localStore);

        const useDispatchMock = jest.spyOn(reactRedux, 'useDispatch');

        const mockLicenseData = {
            id: 'license_id',
            issued_at: 1517714643650,
            starts_at: 1517714643650,
            expires_at: 1620335443650,
            sku_name: 'Enterprise',
            sku_short_name: 'enterprise',
            customer: {
                id: 'customer_id',
                name: 'Test User',
                email: 'test@example.com',
                company: 'Test Company',
            },
            features: {
                users: 123456789,
            },
        };

        let callCount = 0;
        const dummyDispatch = jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                return Promise.resolve({data: mockLicenseData});
            }
            return Promise.resolve({data: {}});
        });
        useDispatchMock.mockReturnValue(dummyDispatch);

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <UploadLicenseModal {...props}/>
            </reactRedux.Provider>,
        );

        // Wait for preview to complete
        await act(async () => {});
        wrapper.update();

        // Click confirm button to upload
        await act(async () => {
            wrapper.find('UploadLicenseModal').find('#confirm-button').simulate('click');
        });

        wrapper.update();

        const modalSubtitle = wrapper.find('UploadLicenseModal').find('.subtitle').text();
        expect(modalSubtitle).toContain('123,456,789');

        useDispatchMock.mockClear();
    });

    test('should hide the upload modal when modal state is closed', () => {
        const UploadLicenseModalHidden = {
            modals: {
                modalState: {},
            },
        };
        const localStore = {...state, views: UploadLicenseModalHidden};
        const store = mockStore(localStore);
        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <UploadLicenseModal {...props}/>
            </reactRedux.Provider>,
        );

        expect(wrapper.find('UploadLicenseModal').find('.content-body')).toHaveLength(0);
    });
});
