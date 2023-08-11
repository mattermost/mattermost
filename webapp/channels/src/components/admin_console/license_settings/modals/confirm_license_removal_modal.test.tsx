// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import {shallow} from 'enzyme';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

import ConfirmLicenseRemovalModal from './confirm_license_removal_modal';

describe('components/admin_console/license_settings/modals/confirm_license_removal_modal', () => {
    // required state to mount using the provider
    const state = {
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
                        open: 'true',
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

    const store = mockStore(state);

    test('should match snapshot', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <ConfirmLicenseRemovalModal {...props}/>
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should call the removal method when confirm button is clicked', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ConfirmLicenseRemovalModal {...props}/>
            </Provider>,
        );
        const confirmButton = wrapper.find('ConfirmLicenseRemovalModal').find('button#confirm-removal');
        confirmButton.simulate('click');
        expect(mockHandleRemove).toHaveBeenCalledTimes(1);
    });

    test('should close the modal when cancel button is clicked', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ConfirmLicenseRemovalModal {...props}/>
            </Provider>,
        );
        const cancelButton = wrapper.find('ConfirmLicenseRemovalModal').find('button#cancel-removal');
        cancelButton.simulate('click');
        expect(mockOnExited).toHaveBeenCalledTimes(1);
    });

    test('should hide the confirm modal', () => {
        const ConfirmLicenseRemovalModalHidden = {
            modals: {
                modalState: {},
            },
        };
        const localStore = {...state, views: ConfirmLicenseRemovalModalHidden};
        const store = mockStore(localStore);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ConfirmLicenseRemovalModal {...props}/>
            </Provider>,
        );
        expect(wrapper.find('ConfirmLicenseRemovalModal').find('div.alert-svg')).toHaveLength(0);
    });

    test('should show which SKU is currently being removed in confirmation message', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ConfirmLicenseRemovalModal {...props}/>
            </Provider>,
        );

        expect(wrapper.find('ConfirmLicenseRemovalModal').find('div.subtitle').find('span').text()).toEqual('Removing the license will downgrade your server from Professional to Free. You may lose information. ');
    });
});
