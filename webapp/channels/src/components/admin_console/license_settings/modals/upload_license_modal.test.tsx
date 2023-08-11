// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act} from 'react-dom/test-utils';
import * as reactRedux from 'react-redux';

import {shallow} from 'enzyme';

import {General} from 'mattermost-redux/constants';

import * as i18Selectors from 'selectors/i18n';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
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
        },
        views: {
            modals: {
                modalState: {
                    upload_license: {
                        open: 'true',
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

    test('should display upload btn Disabled on initial load and no file selected', () => {
        const newProps = {...props};
        newProps.fileObjFromProps = {} as File;
        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <UploadLicenseModal {...newProps}/>
            </reactRedux.Provider>,
        );
        const uploadButton = wrapper.find('UploadLicenseModal').find('button#upload-button');
        expect(uploadButton.prop('disabled')).toBe(true);
    });

    test('should display upload btn Enabled when file is loaded', () => {
        const realUseState = React.useState;
        const initialStateForFileObj = {name: 'testing.mattermost-license', size: 10240000} as File;

        jest.spyOn(React, 'useState').mockImplementationOnce(() => realUseState(initialStateForFileObj as any));
        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <UploadLicenseModal {...props}/>
            </reactRedux.Provider>,
        );
        const uploadButton = wrapper.find('UploadLicenseModal').find('button#upload-button');
        expect(uploadButton.prop('disabled')).toBe(false);
    });

    test('should display no file selected text when no file is loaded', () => {
        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <UploadLicenseModal {...props}/>
            </reactRedux.Provider>,
        );
        const fileText = wrapper.find('UploadLicenseModal').find('.file-name-section span');
        expect(fileText.text()).toEqual('No file selected');
    });

    test('should display the file name when is selected', () => {
        const realUseState = React.useState;
        const initialStateForFileObj = {name: 'testing.mattermost-license', size: (5 * 1024)} as File;

        jest.spyOn(React, 'useState').mockImplementationOnce(() => realUseState(initialStateForFileObj as any));
        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <UploadLicenseModal {...props}/>
            </reactRedux.Provider>,
        );
        const fileTextName = wrapper.find('UploadLicenseModal').find('.file-name-section span.file-name');
        const fileTextSize = wrapper.find('UploadLicenseModal').find('.file-name-section span.file-size');

        expect(fileTextName.text()).toEqual('testing.mattermost-license');
        expect(fileTextSize.text()).toEqual('5KB');
    });

    test('should show success image when open and there is a license (successful license upload)', async () => {
        const licensedState = {
            general: {
                license: {...license},
            },
        };
        const localStore = {...state, entities: licensedState};
        const store = mockStore(localStore);

        const useDispatchMock = jest.spyOn(reactRedux, 'useDispatch');

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch.mockImplementation(() => new Promise((resolve) => {
            resolve('');
        })));

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <UploadLicenseModal {...props}/>
            </reactRedux.Provider>,
        );

        await act(async () => {
            wrapper.find('UploadLicenseModal').find('#upload-button').simulate('click'); // simulate successful upload of license
        });

        wrapper.update();
        expect(wrapper.find('UploadLicenseModal').find('.hands-svg')).toHaveLength(1);
        expect(wrapper.find('UploadLicenseModal').find('#done-button')).toHaveLength(1);

        useDispatchMock.mockClear();
    });

    test('should format users number', async () => {
        const licensedState = {
            general: {
                license: {...license, Users: '123456789'},
            },
        };
        const localStore = {...state, entities: licensedState};
        const store = mockStore(localStore);

        const useDispatchMock = jest.spyOn(reactRedux, 'useDispatch');

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch.mockImplementation(() => new Promise((resolve) => {
            resolve('');
        })));

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <UploadLicenseModal {...props}/>
            </reactRedux.Provider>,
        );

        await act(async () => {
            wrapper.find('UploadLicenseModal').find('#upload-button').simulate('click'); // simulate successful upload of license
        });

        const modalSubtitle = wrapper.find('UploadLicenseModal').find('.subtitle').text();
        expect(modalSubtitle).toContain('123,456,789');

        useDispatchMock.mockClear();
    });

    test('should hide the upload modal', () => {
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

        expect(wrapper.find('UploadLicenseModal').find('content-body')).toHaveLength(0);
    });
});
