// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import ResizableLhs from './index';

describe('components/resizable_sidebar/resizable_lhs', () => {
    const baseState: DeepPartial<GlobalState> = {
        entities: {
            users: {
                currentUserId: 'current_user_id',
            },
            teams: {
                currentTeamId: 'team_id',
            },
            general: {
                config: {},
            },
        },
        views: {
            browser: {
                windowSize: 'desktopView',
            },
        },
        storage: {
            storage: {},
        },
    };

    test('should render without free-resizing class when feature flag is disabled', () => {
        const state: DeepPartial<GlobalState> = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    config: {
                        FeatureFlagFreeSidebarResizing: 'false',
                    },
                },
            },
        };

        renderWithContext(
            <ResizableLhs id='test-lhs'>
                <div>{'Content'}</div>
            </ResizableLhs>,
            state,
        );

        const container = document.getElementById('test-lhs');
        expect(container).toBeInTheDocument();
        expect(container).not.toHaveClass('free-resizing');
    });

    test('should render with free-resizing class when feature flag is enabled', () => {
        const state: DeepPartial<GlobalState> = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    config: {
                        FeatureFlagFreeSidebarResizing: 'true',
                    },
                },
            },
        };

        renderWithContext(
            <ResizableLhs id='test-lhs'>
                <div>{'Content'}</div>
            </ResizableLhs>,
            state,
        );

        const container = document.getElementById('test-lhs');
        expect(container).toBeInTheDocument();
        expect(container).toHaveClass('free-resizing');
    });

    test('should render children correctly', () => {
        renderWithContext(
            <ResizableLhs id='test-lhs'>
                <div data-testid='child-content'>{'Test Content'}</div>
            </ResizableLhs>,
            baseState,
        );

        expect(screen.getByTestId('child-content')).toBeInTheDocument();
        expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    test('should apply custom className', () => {
        renderWithContext(
            <ResizableLhs id='test-lhs' className='custom-class'>
                <div>{'Content'}</div>
            </ResizableLhs>,
            baseState,
        );

        const container = document.getElementById('test-lhs');
        expect(container).toHaveClass('custom-class');
    });
});
