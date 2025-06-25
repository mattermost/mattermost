// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen, waitFor} from '@testing-library/react';
import React from 'react';
import * as reactRedux from 'react-redux';

import type {Subscription} from '@mattermost/types/cloud';

import {renderWithContext} from 'tests/react_testing_utils';

import CloudPreviewModal from './cloud_preview_modal';

// Mock the async_load module to return components synchronously
jest.mock('components/async_load', () => ({
    makeAsyncComponent: (displayName: string) => {
        // Return a component that renders immediately without suspense
        const Component = (props: any) => {
            // Mock the preview modal controller
            if (displayName === 'PreviewModalController') {
                return props.show ? (
                    <div data-testid='preview-modal-controller'>
                        <button onClick={props.onClose}>{'Close'}</button>
                    </div>
                ) : null;
            }
            return null;
        };
        Component.displayName = displayName;
        return Component;
    },
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

    it('should show modal when in cloud preview and modal has not been shown before', async () => {
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        renderWithContext(
            <CloudPreviewModal/>,
            initialState,
        );

        await waitFor(() => {
            expect(screen.getByTestId('preview-modal-controller')).toBeInTheDocument();
        });
    });

    it('should not show modal when not in cloud preview', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...baseSubscription,
            is_cloud_preview: false,
        };

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        renderWithContext(
            <CloudPreviewModal/>,
            state,
        );

        expect(screen.queryByTestId('preview-modal-controller')).not.toBeInTheDocument();
    });

    it('should not show modal when not cloud', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.general.license.Cloud = 'false';

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        renderWithContext(
            <CloudPreviewModal/>,
            state,
        );

        expect(screen.queryByTestId('preview-modal-controller')).not.toBeInTheDocument();
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

    //     const dummyDispatch = jest.fn();
    //     useDispatchMock.mockReturnValue(dummyDispatch);

    //     renderWithContext(
    //         <CloudPreviewModal/>,
    //         state,
    //     );

    //     expect(screen.queryByTestId('preview-modal-controller')).not.toBeInTheDocument();
    // });

    it('should save preference when modal is closed', async () => {
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        renderWithContext(
            <CloudPreviewModal/>,
            initialState,
        );

        // Wait for modal to appear
        await waitFor(() => {
            expect(screen.getByTestId('preview-modal-controller')).toBeInTheDocument();
        });

        // Click close button
        const closeButton = screen.getByText('Close');
        fireEvent.click(closeButton);

        // Check that dispatch was called (savePreferences action)
        expect(dummyDispatch).toHaveBeenCalled();
    });

    it('should not render anything when subscription is undefined', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = undefined;

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        renderWithContext(
            <CloudPreviewModal/>,
            state,
        );

        expect(screen.queryByTestId('preview-modal-controller')).not.toBeInTheDocument();
    });
});
