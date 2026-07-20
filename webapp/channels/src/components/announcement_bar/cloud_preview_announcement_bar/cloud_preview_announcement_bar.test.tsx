// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as reactRedux from 'react-redux';

import type {Subscription} from '@mattermost/types/cloud';

import {renderWithContext} from 'tests/react_testing_utils';

import CloudPreviewAnnouncementBar from './index';

describe('components/announcement_bar/CloudPreviewAnnouncementBar', () => {
    const useDispatchMock = jest.spyOn(reactRedux, 'useDispatch');

    beforeEach(() => {
        useDispatchMock.mockClear();
    });

    const baseSubscription: Subscription = {
        id: 'test-id',
        customer_id: 'test-customer',
        product_id: 'test-product',
        add_ons: [],
        start_at: Date.now() - (24 * 60 * 60 * 1000), // 1 day ago
        end_at: Date.now() + (2 * 60 * 60 * 1000), // 2 hours from now
        create_at: Date.now() - (24 * 60 * 60 * 1000),
        seats: 10,
        trial_end_at: 0,
        is_free_trial: 'false',
        is_cloud_preview: true,
    };

    const initialState = {
        views: {
            announcementBar: {
                announcementBarState: {
                    announcementBarCount: 1,
                },
            },
        },
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
        },
    };

    it('should show banner when is_cloud_preview is true and isCloud is true', () => {
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const {container} = renderWithContext(
            <CloudPreviewAnnouncementBar/>,
            initialState,
        );

        expect(container.querySelector('.announcement-bar')).not.toBeNull();
        expect(container.textContent).toContain('This is your Mattermost preview environment');
    });

    it('should not show banner when is_cloud_preview is false', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...baseSubscription,
            is_cloud_preview: false,
        };

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const {container} = renderWithContext(
            <CloudPreviewAnnouncementBar/>,
            state,
        );

        expect(container.querySelector('.announcement-bar')).toBeNull();
    });

    it('should not show banner when not cloud', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.general.license.Cloud = 'false';

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const {container} = renderWithContext(
            <CloudPreviewAnnouncementBar/>,
            state,
        );

        expect(container.querySelector('.announcement-bar')).toBeNull();
    });

    it('should not show banner when subscription is undefined', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = undefined;

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const {container} = renderWithContext(
            <CloudPreviewAnnouncementBar/>,
            state,
        );

        expect(container.querySelector('.announcement-bar')).toBeNull();
    });

    it('should display time in correct format when less than a day', () => {
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const {container} = renderWithContext(
            <CloudPreviewAnnouncementBar/>,
            initialState,
        );

        // Should show format like "02h 00m"
        expect(container.textContent).toMatch(/Time left: \d{2}h \d{2}m/);
    });

    it('should display time with days when more than a day', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...baseSubscription,
            end_at: Date.now() + (25 * 60 * 60 * 1000), // 25 hours from now
        };

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const {container} = renderWithContext(
            <CloudPreviewAnnouncementBar/>,
            state,
        );

        // Should show format like "1d 01h 00m"
        expect(container.textContent).toMatch(/Time left: 1d \d{2}h \d{2}m/);
    });

    it('should display only minutes when less than an hour', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...baseSubscription,
            end_at: Date.now() + (45 * 60 * 1000), // 45 minutes from now
        };

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const {container} = renderWithContext(
            <CloudPreviewAnnouncementBar/>,
            state,
        );

        // Should show format like "45m"
        expect(container.textContent).toMatch(/Time left: \d{2}m/);
    });

    it('should display seconds when less than a minute', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...baseSubscription,
            end_at: Date.now() + (30 * 1000), // 30 seconds from now
        };

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const {container} = renderWithContext(
            <CloudPreviewAnnouncementBar/>,
            state,
        );

        // Should show format like "30s"
        expect(container.textContent).toMatch(/Time left: \d+s/);
    });

    it('should display 00:00 when time has expired', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...baseSubscription,
            end_at: Date.now() - 1000, // 1 second ago
        };

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const {container} = renderWithContext(
            <CloudPreviewAnnouncementBar/>,
            state,
        );

        expect(container.textContent).toContain('Time left: 00:00');
    });

    it('should not be dismissable', () => {
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const {container} = renderWithContext(
            <CloudPreviewAnnouncementBar/>,
            initialState,
        );

        // No close button should be present
        expect(container.querySelector('.announcement-bar__close')).toBeNull();
    });

    it('should show contact sales button', () => {
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const {container} = renderWithContext(
            <CloudPreviewAnnouncementBar/>,
            initialState,
        );

        expect(container.textContent).toContain('Contact sales');
    });

    it('should have advisor type', () => {
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const {container} = renderWithContext(
            <CloudPreviewAnnouncementBar/>,
            initialState,
        );

        expect(container.querySelector('.announcement-bar.announcement-bar-advisor')).not.toBeNull();
    });
});
