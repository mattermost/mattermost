// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as reactRedux from 'react-redux';

import type {Subscription} from '@mattermost/types/cloud';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

import CloudPreviewModal from './cloud_preview_modal';

// Mock the PreviewModalController to avoid complex modal testing
jest.mock('./preview_modal_controller', () => ({
    __esModule: true,
    default: ({show, onClose}: {show: boolean; onClose: () => void}) => (show ? (
        <div data-testid='preview-modal-controller'>
            <button onClick={onClose}>{'Close'}</button>
        </div>
    ) : null),
}));

describe('CloudPreviewModal', () => {
    const useDispatchMock = jest.spyOn(reactRedux, 'useDispatch');

    beforeEach(() => {
        useDispatchMock.mockClear();
    });

    const baseSubscription: Subscription = {
        id: 'test-id',
        customer_id: 'test-customer',
        product_id: 'test-product',
        add_ons: [],
        start_at: Date.now() - (24 * 60 * 60 * 1000),
        end_at: Date.now() + (2 * 60 * 60 * 1000),
        create_at: Date.now() - (24 * 60 * 60 * 1000),
        seats: 10,
        trial_end_at: 0,
        is_free_trial: 'false',
        is_cloud_preview: true,
    };

    const initialState = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                    Cloud: 'true',
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {roles: 'system_admin'},
                },
            },
            cloud: {
                subscription: baseSubscription,
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    it('should show modal when in cloud preview and modal has not been shown before', () => {
        const store = mockStore(initialState);

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <CloudPreviewModal/>
            </reactRedux.Provider>,
        );

        wrapper.update();
        expect(wrapper.find('[data-testid="preview-modal-controller"]').exists()).toEqual(true);
    });

    it('should not show modal when not in cloud preview', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...baseSubscription,
            is_cloud_preview: false,
        };

        const store = mockStore(state);

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <CloudPreviewModal/>
            </reactRedux.Provider>,
        );

        wrapper.update();
        expect(wrapper.find('[data-testid="preview-modal-controller"]').exists()).toEqual(false);
    });

    it('should not show modal when not cloud', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.general.license.Cloud = 'false';

        const store = mockStore(state);

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <CloudPreviewModal/>
            </reactRedux.Provider>,
        );

        wrapper.update();
        expect(wrapper.find('[data-testid="preview-modal-controller"]').exists()).toEqual(false);
    });

    // Skip for now.
    // it('should not show modal when modal has been shown before', () => {
    //     const state = JSON.parse(JSON.stringify(initialState));
    //     state.entities.preferences.myPreferences = {
    //         'cloud_preview_modal_shown--cloud_preview_modal_shown': {
    //             category: 'cloud_preview_modal_shown',
    //             name: 'cloud_preview_modal_shown',
    //             value: 'true',
    //         },
    //     };

    //     const store = mockStore(state);

    //     const dummyDispatch = jest.fn();
    //     useDispatchMock.mockReturnValue(dummyDispatch);

    //     const wrapper = mountWithIntl(
    //         <reactRedux.Provider store={store}>
    //             <CloudPreviewModal/>
    //         </reactRedux.Provider>,
    //     );

    //     wrapper.update();
    //     expect(wrapper.find('[data-testid="preview-modal-controller"]').exists()).toEqual(false);
    // });

    it('should save preference when modal is closed', () => {
        const store = mockStore(initialState);

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <CloudPreviewModal/>
            </reactRedux.Provider>,
        );

        wrapper.update();

        // Click close button
        wrapper.find('button').simulate('click');

        // Check that dispatch was called (savePreferences action)
        expect(dummyDispatch).toHaveBeenCalled();
    });

    it('should not render anything when subscription is undefined', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = undefined;

        const store = mockStore(state);

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <CloudPreviewModal/>
            </reactRedux.Provider>,
        );

        wrapper.update();
        expect(wrapper.find('[data-testid="preview-modal-controller"]').exists()).toEqual(false);
    });
});
