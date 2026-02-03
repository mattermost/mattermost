// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as reactRedux from 'react-redux';

import type {Subscription, PreviewModalContentData} from '@mattermost/types/cloud';
import type {TeamType} from '@mattermost/types/teams';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import CloudPreviewModal from './cloud_preview_modal_controller';
import {modalContent} from './preview_modal_content_data';

// Mock the useGetCloudPreviewModalContent hook
const mockUseGetCloudPreviewModalContent = jest.fn();

jest.mock('hooks/useGetCloudPreviewModalContent', () => ({
    useGetCloudPreviewModalContent: () => mockUseGetCloudPreviewModalContent(),
}));

// Variable to track contentData passed to PreviewModalController
let lastContentData: PreviewModalContentData[] = [];

// Mock the async_load module to return components synchronously
jest.mock('components/async_load', () => ({
    makeAsyncComponent: (displayName: string) => {
        // Return a component that renders immediately without suspense
        const Component = (props: any) => {
            // Mock the preview modal controller
            if (displayName === 'PreviewModalController') {
                // Capture contentData for testing
                lastContentData = props.contentData || [];
                return props.show ? (
                    <div data-testid='preview-modal-controller'>
                        <button onClick={props.onClose}>{'Close'}</button>
                        <div data-testid='content-data-length'>{props.contentData?.length || 0}</div>
                    </div>
                ) : null;
            }
            return null;
        };
        Component.displayName = displayName;
        return Component;
    },
}));

// Mock WithTooltip to avoid complex tooltip testing
jest.mock('components/with_tooltip', () => ({
    __esModule: true,
    default: ({children, title}: {children: React.ReactNode; title: string}) => (
        <div
            data-testid='with-tooltip'
            title={title}
        >
            {children}
        </div>
    ),
}));

describe('CloudPreviewModal', () => {
    const useDispatchMock = jest.spyOn(reactRedux, 'useDispatch');

    beforeEach(() => {
        useDispatchMock.mockClear();
        lastContentData = [];
        mockUseGetCloudPreviewModalContent.mockReturnValue({
            data: null,
            loading: false,
            error: false,
        });
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
            teams: {
                currentTeamId: 'mission-ops-hq',
                teams: {
                    'mission-ops-hq': {
                        id: 'mission-ops-hq',
                        name: 'mission-ops-hq',
                        display_name: 'Mission Ops HQ',
                        type: 'O' as TeamType,
                        create_at: 1234567890,
                        update_at: 1234567890,
                        delete_at: 0,
                        allow_open_invite: true,
                        invite_id: 'test-invite-id',
                        description: 'Test team',
                        email: 'test@example.com',
                        company_name: 'Test Company',
                        allowed_domains: '',
                        scheme_id: '',
                        group_constrained: false,
                        policy_id: null,
                        cloud_limits_archived: false,
                    },
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

    const stateWithModalShown = {
        ...initialState,
        entities: {
            ...initialState.entities,
            preferences: {
                myPreferences: {
                    'cloud_preview_modal_shown--cloud_preview_modal_shown': {
                        category: 'cloud_preview_modal_shown',
                        name: 'cloud_preview_modal_shown',
                        value: 'true',
                    },
                },
            },
        },
    };

    it('should show modal when in cloud preview and modal has not been shown before', () => {
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        renderWithContext(
            <CloudPreviewModal/>,
            initialState,
        );

        expect(screen.getByTestId('preview-modal-controller')).toBeInTheDocument();
        expect(screen.queryByTestId('cloud-preview-fab')).not.toBeInTheDocument();
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

    it('should not show modal when modal has been shown before', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.preferences.myPreferences = {
            'cloud_preview_modal_shown--cloud_preview_modal_shown': {
                category: 'cloud_preview_modal_shown',
                name: 'cloud_preview_modal_shown',
                value: 'true',
            },
        };

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        renderWithContext(
            <CloudPreviewModal/>,
            stateWithModalShown,
        );

        expect(screen.queryByTestId('preview-modal-controller')).not.toBeInTheDocument();
    });

    it('should show FAB when modal has been shown before and modal is not open', () => {
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        renderWithContext(
            <CloudPreviewModal/>,
            stateWithModalShown,
        );

        expect(screen.getByTestId('cloud-preview-fab')).toBeInTheDocument();
        expect(screen.queryByTestId('preview-modal-controller')).not.toBeInTheDocument();
    });

    it('should not show FAB when modal has not been shown before', () => {
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        renderWithContext(
            <CloudPreviewModal/>,
            initialState,
        );

        expect(screen.queryByTestId('cloud-preview-fab')).not.toBeInTheDocument();
        expect(screen.getByTestId('preview-modal-controller')).toBeInTheDocument();
    });

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
        await userEvent.click(closeButton);

        // Check that dispatch was called (savePreferences action)
        expect(dummyDispatch).toHaveBeenCalled();
    });

    it('should reset preference and reopen modal when FAB is clicked', async () => {
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        renderWithContext(
            <CloudPreviewModal/>,
            stateWithModalShown,
        );

        // FAB should be visible
        const fabButton = screen.getByTestId('cloud-preview-fab');
        expect(fabButton).toBeInTheDocument();

        // Click the FAB button
        const button = fabButton.querySelector('button');
        expect(button).toBeInTheDocument();
        await userEvent.click(button!);

        // Check that dispatch was called to reset the preference
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
        expect(screen.queryByTestId('cloud-preview-fab')).not.toBeInTheDocument();
    });

    it('should have proper tooltip on FAB button', () => {
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        renderWithContext(
            <CloudPreviewModal/>,
            stateWithModalShown,
        );

        const tooltip = screen.getByTestId('with-tooltip');
        expect(tooltip).toHaveAttribute('title', 'Open overview');
    });

    it('should have proper accessibility attributes on FAB button', () => {
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        renderWithContext(
            <CloudPreviewModal/>,
            stateWithModalShown,
        );

        const fabButton = screen.getByTestId('cloud-preview-fab').querySelector('button');
        expect(fabButton).toHaveAttribute('aria-label', 'Open cloud preview overview');
        expect(fabButton).toHaveClass('cloud-preview-modal-fab__button');
    });

    it('should use dynamic content when available', () => {
        const dynamicContent: PreviewModalContentData[] = [
            {
                skuLabel: {
                    id: 'dynamic.sku.label',
                    defaultMessage: 'Dynamic SKU',
                },
                title: {
                    id: 'dynamic.title',
                    defaultMessage: 'Dynamic Title',
                },
                subtitle: {
                    id: 'dynamic.subtitle',
                    defaultMessage: 'Dynamic Subtitle',
                },
                videoUrl: 'https://example.com/dynamic-video.mp4',
                videoPoster: 'https://example.com/dynamic-poster.jpg',
                useCase: 'mission-ops',
            },
        ];

        mockUseGetCloudPreviewModalContent.mockReturnValue({
            data: dynamicContent,
            loading: false,
            error: false,
        });

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        renderWithContext(
            <CloudPreviewModal/>,
            initialState,
        );

        expect(screen.getByTestId('preview-modal-controller')).toBeInTheDocument();
        expect(lastContentData).toHaveLength(1);
        expect(lastContentData[0]).toEqual(dynamicContent[0]);
        expect(lastContentData[0].title.defaultMessage).toBe('Dynamic Title');
    });

    it('should fallback to hardcoded content when dynamic content is not available', () => {
        mockUseGetCloudPreviewModalContent.mockReturnValue({
            data: null,
            loading: false,
            error: false,
        });

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        renderWithContext(
            <CloudPreviewModal/>,
            initialState,
        );

        expect(screen.getByTestId('preview-modal-controller')).toBeInTheDocument();
        const missionOpsContent = modalContent.filter((content) => content.useCase === 'mission-ops');
        expect(lastContentData).toHaveLength(missionOpsContent.length);
        expect(lastContentData[0].title.defaultMessage).toBe('Welcome to your Mattermost preview');
    });

    it('should fallback to hardcoded content when dynamic content is empty', () => {
        mockUseGetCloudPreviewModalContent.mockReturnValue({
            data: [],
            loading: false,
            error: false,
        });

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        renderWithContext(
            <CloudPreviewModal/>,
            initialState,
        );

        expect(screen.getByTestId('preview-modal-controller')).toBeInTheDocument();
        const missionOpsContent = modalContent.filter((content) => content.useCase === 'mission-ops');
        expect(lastContentData).toHaveLength(missionOpsContent.length);
        expect(lastContentData[0].title.defaultMessage).toBe('Welcome to your Mattermost preview');
    });

    it('should not show modal when content is loading', () => {
        mockUseGetCloudPreviewModalContent.mockReturnValue({
            data: null,
            loading: true,
            error: false,
        });

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        renderWithContext(
            <CloudPreviewModal/>,
            initialState,
        );

        expect(screen.queryByTestId('preview-modal-controller')).not.toBeInTheDocument();
    });

    it('should fallback to hardcoded content when there is an error fetching dynamic content', () => {
        mockUseGetCloudPreviewModalContent.mockReturnValue({
            data: null,
            loading: false,
            error: true,
        });

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        renderWithContext(
            <CloudPreviewModal/>,
            initialState,
        );

        expect(screen.getByTestId('preview-modal-controller')).toBeInTheDocument();
        const missionOpsContent = modalContent.filter((content) => content.useCase === 'mission-ops');
        expect(lastContentData).toHaveLength(missionOpsContent.length);
        expect(lastContentData[0].title.defaultMessage).toBe('Welcome to your Mattermost preview');
    });
});
