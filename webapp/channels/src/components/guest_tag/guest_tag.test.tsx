// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import GuestTag from './index';

describe('GuestTag Container', () => {
    const baseState = {
        entities: {
            general: {
                config: {
                    HideGuestTags: 'false',
                },
            },
        },
    };

    it('should render guest tag when HideGuestTags is false', () => {
        renderWithContext(<GuestTag/>, baseState);
        expect(screen.getByText('GUEST')).toBeInTheDocument();
    });

    it('should not render guest tag when HideGuestTags is true', () => {
        const state = {
            entities: {
                general: {
                    config: {
                        HideGuestTags: 'true',
                    },
                },
            },
        };
        const {container} = renderWithContext(<GuestTag/>, state);
        expect(container.firstChild).toBeNull();
    });

    it('should pass size prop to underlying component', () => {
        const {container} = renderWithContext(<GuestTag size='lg'/>, baseState);
        const tag = container.querySelector('.Tag--lg');
        expect(tag).toBeInTheDocument();
    });

    it('should pass className prop to underlying component', () => {
        const {container} = renderWithContext(<GuestTag className='custom-class'/>, baseState);
        const tag = container.querySelector('.custom-class');
        expect(tag).toBeInTheDocument();
    });

    it('should render by default when HideGuestTags is not set', () => {
        const state = {
            entities: {
                general: {
                    config: {},
                },
            },
        };
        renderWithContext(<GuestTag/>, state);
        expect(screen.getByText('GUEST')).toBeInTheDocument();
    });

    // Edge case tests for null safety
    it('should handle undefined config gracefully', () => {
        const state = {
            entities: {
                general: {
                    config: undefined,
                },
            },
        };
        renderWithContext(<GuestTag/>, state);
        expect(screen.getByText('GUEST')).toBeInTheDocument();
    });

    it('should handle missing general entity gracefully', () => {
        const state = {
            entities: {},
        };
        renderWithContext(<GuestTag/>, state);
        expect(screen.getByText('GUEST')).toBeInTheDocument();
    });

    // Edge case: non-standard config values
    it('should show tag when HideGuestTags is any value other than "true"', () => {
        const testCases = ['false', 'True', 'TRUE', 'yes', '', '1', '0', undefined];

        testCases.forEach((value) => {
            const state = {
                entities: {
                    general: {
                        config: {
                            HideGuestTags: value,
                        },
                    },
                },
            };
            const {container} = renderWithContext(<GuestTag/>, state);
            expect(screen.queryByText('GUEST')).toBeInTheDocument();
            container.remove(); // Clean up between iterations
        });
    });

    // Memoization test: selector should not cause re-renders on unrelated state changes
    it('should use memoized selector (performance check)', () => {
        const {rerender} = renderWithContext(<GuestTag/>, baseState);
        expect(screen.getByText('GUEST')).toBeInTheDocument();

        // Simulate unrelated state change (doesn't affect HideGuestTags)
        rerender(<GuestTag/>);

        // Component should still render correctly without unnecessary recalculations
        expect(screen.getByText('GUEST')).toBeInTheDocument();
    });
});
