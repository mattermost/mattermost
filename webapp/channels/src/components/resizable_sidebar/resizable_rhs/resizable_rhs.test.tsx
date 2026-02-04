// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {createRef} from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import {SidebarSize} from '../constants';

import ResizableRhs from './index';

describe('components/resizable_sidebar/resizable_rhs', () => {
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
            rhs: {
                isSidebarExpanded: false,
                rhsSize: SidebarSize.MEDIUM,
            },
        },
        storage: {
            storage: {},
        },
    };

    const rightWidthHolderRef = createRef<HTMLDivElement>();

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
            <ResizableRhs id='test-rhs' rightWidthHolderRef={rightWidthHolderRef}>
                <div>{'Content'}</div>
            </ResizableRhs>,
            state,
        );

        const container = document.getElementById('test-rhs');
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
            <ResizableRhs id='test-rhs' rightWidthHolderRef={rightWidthHolderRef}>
                <div>{'Content'}</div>
            </ResizableRhs>,
            state,
        );

        const container = document.getElementById('test-rhs');
        expect(container).toBeInTheDocument();
        expect(container).toHaveClass('free-resizing');
    });

    test('should render children correctly', () => {
        renderWithContext(
            <ResizableRhs id='test-rhs' rightWidthHolderRef={rightWidthHolderRef}>
                <div data-testid='child-content'>{'Test Content'}</div>
            </ResizableRhs>,
            baseState,
        );

        expect(screen.getByTestId('child-content')).toBeInTheDocument();
        expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    test('should apply custom className', () => {
        renderWithContext(
            <ResizableRhs id='test-rhs' className='custom-class' rightWidthHolderRef={rightWidthHolderRef}>
                <div>{'Content'}</div>
            </ResizableRhs>,
            baseState,
        );

        const container = document.getElementById('test-rhs');
        expect(container).toHaveClass('custom-class');
    });

    test('should set aria attributes correctly', () => {
        renderWithContext(
            <ResizableRhs
                id='test-rhs'
                rightWidthHolderRef={rightWidthHolderRef}
                ariaLabel='Test sidebar'
                role='complementary'
            >
                <div>{'Content'}</div>
            </ResizableRhs>,
            baseState,
        );

        const container = document.getElementById('test-rhs');
        expect(container).toHaveAttribute('aria-label', 'Test sidebar');
        expect(container).toHaveAttribute('role', 'complementary');
    });
});
